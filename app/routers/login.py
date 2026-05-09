from fastapi import Depends, status, HTTPException, APIRouter, Response, Request, Form
from sqlalchemy.orm import Session
from app import models
from ..database import get_db
from .. import models, utils, OAuth2, schemas
from fastapi.security.oauth2 import OAuth2PasswordRequestForm
from datetime import datetime, timedelta, timezone
import random
from ..email_service import send_verification_email, send_password_reset_email
from google.oauth2 import id_token
from google.auth.transport import requests
import os
import httpx

router = APIRouter(
     tags=['Login']
)


def _is_truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _use_secure_cookie() -> bool:
    configured = os.getenv("COOKIE_SECURE")
    if configured is not None:
        return _is_truthy(configured)
    return os.getenv("ENV", "").strip().lower() == "production"


def _allow_verification_code_in_response() -> bool:
    if _is_truthy(os.getenv("RETURN_VERIFICATION_CODE_IN_RESPONSE")):
        return True
    return os.getenv("ENV", "").strip().lower() in {"dev", "development", "local"}


def _set_refresh_token_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=OAuth2.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=_use_secure_cookie(),
        samesite="lax",
        max_age=OAuth2.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_token_cookie(response: Response) -> None:
    response.delete_cookie(
        key=OAuth2.REFRESH_TOKEN_COOKIE_NAME,
        httponly=True,
        secure=_use_secure_cookie(),
        samesite="lax",
        path="/",
    )


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def new_user(user_data: schemas.UserBase, db: Session = Depends(get_db)):
    users = db.query(models.DBUser).filter(models.DBUser.email == user_data.email).first()
    if users:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    
    hashed_password = utils.hash(user_data.password)
    
    # Generate verification code
    verification_code = generate_verification_code()
    verification_code_expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    new_user = models.DBUser(
        email=user_data.email,
        password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        country=user_data.country,
        city=user_data.city,
        street=user_data.street,
        role="customer",  # All new signups are customers by default
        is_verified=False,
        verification_code=verification_code,
        verification_code_expires=verification_code_expires
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send verification email
    email_sent = False
    try:
        email_sent = send_verification_email(
            email=user_data.email,
            verification_code=verification_code,
            first_name=user_data.first_name
        )
    except Exception as e:
        # If email fails, still return success but log the error
        # You might want to handle this differently based on your requirements
        print(f"Failed to send verification email: {str(e)}")
        email_sent = False
    
    # Prepare response
    response_data = {
        "message": "Account created successfully. Please check your email for verification code.",
        "email": user_data.email
    }
    
    # If email wasn't sent (e.g., SMTP not configured), include code only when explicitly enabled.
    if not email_sent:
        print(f"\n{'='*60}")
        print(f"EMAIL NOT SENT - SMTP not configured")
        print(f"Verification code for {user_data.email}: {verification_code}")
        print(f"{'='*60}\n")
        if _allow_verification_code_in_response():
            response_data["verification_code"] = verification_code
            response_data["message"] = "Account created successfully. Email service not configured. Use the verification code below."
        else:
            response_data["message"] = "Account created successfully. Verification email could not be sent right now. Please contact support."
    
    return response_data 

@router.post("/verify-email")
def verify_email(verification_data: schemas.EmailVerification, db: Session = Depends(get_db)):
    """Verify user email with 6-digit code"""
    try:
        user = db.query(models.DBUser).filter(models.DBUser.email == verification_data.email).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )
        
        # Check if verification code exists
        if not user.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please sign up again."
            )
        
        # Check if verification code matches
        if user.verification_code != verification_data.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Check if code has expired
        if user.verification_code_expires:
            # Use timezone-aware datetime for comparison
            now = datetime.now(timezone.utc)
            # Ensure both are timezone-aware for comparison
            if isinstance(user.verification_code_expires, datetime):
                if user.verification_code_expires.tzinfo is None:
                    # If stored datetime is naive, assume UTC
                    expires = user.verification_code_expires.replace(tzinfo=timezone.utc)
                else:
                    expires = user.verification_code_expires
                
                if now > expires:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Verification code has expired. Please request a new one."
                    )
        
        # Verify the user
        user.is_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        
        db.commit()
        
        return {"message": "Email verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        print(f"Error in verify_email: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during verification"
        )

@router.post("/auth/google")
async def google_auth(
    google_token: schemas.GoogleAuth,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticate user with Google OAuth token"""
    try:
        # Verify the Google token
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured"
            )
        
        # Fetch user info from Google using access token
        try:
            async with httpx.AsyncClient() as client:
                # Use v3 endpoint which is more reliable and includes picture
                google_response = await client.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {google_token.token}'},
                    params={'alt': 'json'}
                )
                if google_response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Google token"
                    )
                user_info = google_response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to verify Google token"
            )
        
        # Extract user information
        # Google OAuth v3 uses 'sub' instead of 'id' for user identifier
        google_id = user_info.get('sub') or user_info.get('id')
        email = user_info.get('email')
        first_name = user_info.get('given_name', '') or user_info.get('name', '').split()[0] if user_info.get('name') else 'User'
        last_name = user_info.get('family_name', '') or ' '.join(user_info.get('name', '').split()[1:]) if user_info.get('name') and len(user_info.get('name', '').split()) > 1 else ''
        picture = user_info.get('picture')  # Google profile picture URL
        
        # Ensure first_name and last_name are not empty (database requirement)
        if not first_name or first_name.strip() == '':
            first_name = 'User'
        if not last_name or last_name.strip() == '':
            last_name = email.split('@')[0] if email else 'User'
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )
        
        # Use email as fallback if google_id is not available (shouldn't happen, but just in case)
        if not google_id:
            print(f"Warning: Google ID not found, using email as identifier. Available fields: {list(user_info.keys())}")
            # Use email hash as google_id fallback
            import hashlib
            google_id = hashlib.md5(email.encode()).hexdigest()
            print(f"Generated fallback google_id: {google_id}")
        
        # Check if user exists
        user = db.query(models.DBUser).filter(
            (models.DBUser.email == email) | (models.DBUser.google_id == google_id)
        ).first()
        
        try:
            if user:
                # User exists - update Google ID and provider if not set
                updated = False
                if not user.google_id:
                    user.google_id = google_id
                    user.provider = "google"
                    updated = True
                
                # Only update profile image from Google if user doesn't have a custom image
                # Custom images are stored locally (start with "images/"), Google images are URLs
                if picture:
                    # Check if user has a custom uploaded image (local file path)
                    has_custom_image = user.profile_image and user.profile_image.startswith('images/')
                    
                    # Only update if user doesn't have a custom image
                    # (profile_image is None or it's still a Google URL)
                    if not has_custom_image:
                        user.profile_image = picture
                        updated = True
                
                # Auto-verify OAuth users
                if not user.is_verified:
                    user.is_verified = True
                    updated = True
                
                if updated:
                    db.commit()
                    db.refresh(user)
            else:
                # Create new user
                print(f"Creating new user with email: {email}")
                user = models.DBUser(
                    email=email,
                    password=None,  # No password for OAuth users
                    first_name=first_name,
                    last_name=last_name,
                    provider="google",
                    google_id=google_id,
                    profile_image=picture if picture else None,  # Save Google profile image
                    role="customer",  # All new OAuth signups are customers by default
                    is_verified=True  # Auto-verify OAuth users
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"Successfully created new user: {user.email}, ID: {user.id}, profile_image: {user.profile_image}")
        except Exception as db_error:
            db.rollback()
            error_msg = f"Database error during user creation/update: {str(db_error)}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or update user"
            )
        
        # Verify user was created/retrieved successfully
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve user"
            )

        if getattr(user, "is_blocked", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been suspended.",
            )
        
        # Increment token_version to invalidate all previous sessions
        user.token_version = (user.token_version or 0) + 1
        db.commit()
        db.refresh(user)
        
        # Generate JWT token pair
        token = OAuth2.create_access_token(data={"user_id": user.id}, token_version=user.token_version)
        refresh_token = OAuth2.create_refresh_token(data={"user_id": user.id}, token_version=user.token_version)
        _set_refresh_token_cookie(response, refresh_token)
        
        return {
            "access_token": token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error in google_auth: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during Google authentication"
        )

@router.post("/login")
def login(
    response: Response,
    remember_me: bool = Form(False),
    user_credentials: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
): 
    try:
        getuser = db.query(models.DBUser).filter(models.DBUser.email == user_credentials.username).first()
        if not getuser :
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="this is email not a found ")

        if getattr(getuser, "is_blocked", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been suspended.",
            )

        # Allow Google accounts to login with email/password only after they set one.
        if not getuser.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account does not have a password yet. Please sign in with Google first, then set a password from Profile."
            )

        if not utils.verify(user_credentials.password, getuser.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="this is password error")
        
        # Increment token_version to invalidate all previous sessions
        getuser.token_version = (getuser.token_version or 0) + 1
        db.commit()
        db.refresh(getuser)
        
        token = OAuth2.create_access_token(data={"user_id": getuser.id}, token_version=getuser.token_version)
        refresh_token = OAuth2.create_refresh_token(
            data={"user_id": getuser.id},
            token_version=getuser.token_version,
        )
        if remember_me:
            _set_refresh_token_cookie(response, refresh_token)
        else:
            _clear_refresh_token_cookie(response)

        return {"access_token" : token , 
                "token_type" : 'bearer',
                # "username" : getuser.email,
                # "user_id" : getuser.id
                }
    except HTTPException:
        raise
    except Exception as e:
        # Log the actual error for debugging
        print(f"Login error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/refresh-session")
def refresh_session(
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
    db: Session = Depends(get_db),
):
    """Issue a new access token with a fresh expiration window."""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    token = OAuth2.create_access_token(
        data={"user_id": user.id},
        token_version=user.token_version or 0,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/refresh-token")
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Issue a fresh access token using a refresh token cookie."""
    raw_refresh_token = request.cookies.get(OAuth2.REFRESH_TOKEN_COOKIE_NAME)
    if not raw_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing.",
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = OAuth2.verify_refresh_token(raw_refresh_token, credentials_exception)

    user = db.query(models.DBUser).filter(models.DBUser.id == token_data.id).first()
    if user is None:
        raise credentials_exception

    user_token_version = user.token_version if user.token_version is not None else 0
    token_token_version = token_data.token_version if token_data.token_version is not None else 0
    if user_token_version != token_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if getattr(user, "is_blocked", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been suspended.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    new_access_token = OAuth2.create_access_token(
        data={"user_id": user.id},
        token_version=user_token_version,
    )
    new_refresh_token = OAuth2.create_refresh_token(
        data={"user_id": user.id},
        token_version=user_token_version,
    )
    _set_refresh_token_cookie(response, new_refresh_token)

    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    """Clear the refresh token cookie on this device."""
    _clear_refresh_token_cookie(response)
    return {"message": "Logged out successfully"}

@router.post("/forgot-password")
def forgot_password(request: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset - sends verification code to email"""
    try:
        user = db.query(models.DBUser).filter(models.DBUser.email == request.email).first()
        
        if not user:
            # Don't reveal if email exists for security reasons
            return {
                "message": "If the email exists, a verification code has been sent.",
                "email": request.email
            }
        
        # Allow reset for Google accounts that already have a password set.
        if not user.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account does not have a password yet. Please sign in with Google first, then set a password from Profile."
            )
        
        # Generate verification code
        verification_code = generate_verification_code()
        verification_code_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        # Store verification code in user record
        user.verification_code = verification_code
        user.verification_code_expires = verification_code_expires
        
        db.commit()
        
        # Send password reset email
        email_sent = False
        try:
            email_sent = send_password_reset_email(
                email=user.email,
                verification_code=verification_code,
                first_name=user.first_name
            )
        except Exception as e:
            print(f"Failed to send password reset email: {str(e)}")
            email_sent = False
        
        # Prepare response
        response_data = {
            "message": "If the email exists, a verification code has been sent.",
            "email": request.email
        }
        
        # If email wasn't sent (e.g., SMTP not configured), include code only when explicitly enabled.
        if not email_sent:
            print(f"\n{'='*60}")
            print(f"EMAIL NOT SENT - SMTP not configured")
            print(f"Password reset code for {user.email}: {verification_code}")
            print(f"{'='*60}\n")
            if _allow_verification_code_in_response():
                response_data["verification_code"] = verification_code
                response_data["message"] = "Password reset code generated. Email service not configured. Use the verification code below."
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in forgot_password: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing forgot password"
        )

@router.post("/verify-reset-code")
def verify_reset_code(verification_data: schemas.VerifyResetCode, db: Session = Depends(get_db)):
    """Verify password reset code"""
    try:
        user = db.query(models.DBUser).filter(models.DBUser.email == verification_data.email).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if verification code exists
        if not user.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a password reset."
            )
        
        # Check if verification code matches
        if user.verification_code != verification_data.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Check if code has expired
        if user.verification_code_expires:
            now = datetime.now(timezone.utc)
            if isinstance(user.verification_code_expires, datetime):
                if user.verification_code_expires.tzinfo is None:
                    expires = user.verification_code_expires.replace(tzinfo=timezone.utc)
                else:
                    expires = user.verification_code_expires
                
                if now > expires:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Verification code has expired. Please request a new one."
                    )
        
        return {"message": "Verification code is valid. You can now reset your password."}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in verify_reset_code: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while verifying reset code"
        )

@router.post("/reset-password")
def reset_password(reset_data: schemas.ResetPassword, db: Session = Depends(get_db)):
    """Reset password with verified code"""
    try:
        user = db.query(models.DBUser).filter(models.DBUser.email == reset_data.email).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if verification code exists
        if not user.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a password reset."
            )
        
        # Check if verification code matches
        if user.verification_code != reset_data.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Check if code has expired
        if user.verification_code_expires:
            now = datetime.now(timezone.utc)
            if isinstance(user.verification_code_expires, datetime):
                if user.verification_code_expires.tzinfo is None:
                    expires = user.verification_code_expires.replace(tzinfo=timezone.utc)
                else:
                    expires = user.verification_code_expires
                
                if now > expires:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Verification code has expired. Please request a new one."
                    )
        
        # Reset password
        hashed_password = utils.hash(reset_data.new_password)
        user.password = hashed_password
        user.verification_code = None
        user.verification_code_expires = None
        
        db.commit()
        
        return {"message": "Password reset successfully. You can now login with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in reset_password: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while resetting password"
        )
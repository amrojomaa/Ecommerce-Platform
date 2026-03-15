from fastapi import Depends, status, HTTPException, APIRouter
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
import logging
from app.config import settings
from app.rate_limiter import auth_rate_limit_dependency

router = APIRouter(
     tags=['Login']
)

logger = logging.getLogger(__name__)

auth_rate_limit = auth_rate_limit_dependency(
    max_requests=settings.auth_rate_limit_count,
    window_seconds=settings.auth_rate_limit_window_seconds,
)

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

@router.post("/signup", status_code=status.HTTP_201_CREATED, dependencies=[Depends(auth_rate_limit)])
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
        logger.warning("Failed to send verification email: %s", str(e))
        email_sent = False
    
    # Prepare response
    response_data = {
        "message": "Account created successfully. Please check your email for verification code.",
        "email": user_data.email
    }
    
    # Never expose verification codes outside development.
    if not email_sent and settings.allow_dev_verification_code and not settings.is_production:
        response_data["verification_code"] = verification_code
        response_data["message"] = "Account created successfully. Email service not configured in development."
    
    return response_data 

@router.post("/verify-email", dependencies=[Depends(auth_rate_limit)])
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
    except Exception:
        logger.exception("Error in verify_email")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during verification"
        )

@router.post("/auth/google")
async def google_auth(google_token: schemas.GoogleAuth, db: Session = Depends(get_db)):
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
                response = await client.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {google_token.token}'},
                    params={'alt': 'json'}
                )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Google token"
                    )
                user_info = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to verify Google token: {str(e)}"
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
            # Use email hash as google_id fallback
            import hashlib
            google_id = hashlib.md5(email.encode()).hexdigest()
            logger.warning("Google ID not found; using generated fallback for user %s", email)
        
        # Check if user exists
        user = db.query(models.DBUser).filter(
            (models.DBUser.email == email) | (models.DBUser.google_id == google_id)
        ).first()
        
        try:
            if user:
                # Check if user is blocked
                if user.is_blocked:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your account has been blocked. Please contact the administrator."
                    )
                
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
        except Exception as db_error:
            db.rollback()
            logger.exception("Database error during Google auth upsert")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create/update user"
            )
        
        # Verify user was created/retrieved successfully
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve user"
            )
        
        # Increment token_version to invalidate all previous sessions
        user.token_version = (user.token_version or 0) + 1
        db.commit()
        db.refresh(user)
        
        # Generate JWT token
        token = OAuth2.create_access_token(data={"user_id": user.id}, token_version=user.token_version)
        
        return {
            "access_token": token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error in google_auth")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during Google authentication"
        )

@router.post("/login", dependencies=[Depends(auth_rate_limit)])
def login(user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends (get_db)): 
    try:
        getuser = db.query(models.DBUser).filter(models.DBUser.email == user_credentials.username).first()
        if not getuser :
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="this is email not a found ")

        # Check if user is blocked
        if getuser.is_blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been blocked. Please contact the administrator."
            )

        # Check if user is OAuth user (no password)
        if getuser.provider == "google" or not getuser.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was created with Google. Please use Google Sign-In."
            )

        if not utils.verify(user_credentials.password, getuser.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="this is password error")
        
        # Increment token_version to invalidate all previous sessions
        getuser.token_version = (getuser.token_version or 0) + 1
        db.commit()
        db.refresh(getuser)
        
        token = OAuth2.create_access_token(data = {"user_id": getuser.id}, token_version=getuser.token_version)

        return {"access_token" : token , 
                "token_type" : 'bearer',
                # "username" : getuser.email,
                # "user_id" : getuser.id
                }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/forgot-password", dependencies=[Depends(auth_rate_limit)])
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
        
        # Check if user is OAuth user (no password)
        if user.provider == "google" or not user.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was created with Google. Please use Google Sign-In."
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
            logger.warning("Failed to send password reset email: %s", str(e))
            email_sent = False
        
        # Prepare response
        response_data = {
            "message": "If the email exists, a verification code has been sent.",
            "email": request.email
        }
        
        if not email_sent and settings.allow_dev_verification_code and not settings.is_production:
            response_data["verification_code"] = verification_code
            response_data["message"] = "Password reset code generated. Email service not configured in development."
        
        return response_data
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error in forgot_password")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred"
        )

@router.post("/verify-reset-code", dependencies=[Depends(auth_rate_limit)])
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
    except Exception:
        logger.exception("Error in verify_reset_code")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred"
        )

@router.post("/reset-password", dependencies=[Depends(auth_rate_limit)])
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
    except Exception:
        logger.exception("Error in reset_password")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred"
        )
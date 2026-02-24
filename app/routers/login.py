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

router = APIRouter(
     tags=['Login']
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
    
    # If email wasn't sent (e.g., SMTP not configured), include code in response for development
    if not email_sent:
        print(f"\n{'='*60}")
        print(f"EMAIL NOT SENT - SMTP not configured")
        print(f"Verification code for {user_data.email}: {verification_code}")
        print(f"{'='*60}\n")
        response_data["verification_code"] = verification_code
        response_data["message"] = "Account created successfully. Email service not configured. Use the verification code below."
    
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
            detail=f"An error occurred during verification: {str(e)}"
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
                # Debug: Print full user info to see what Google returns
                print(f"Full Google user_info: {user_info}")
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
        
        # Debug: Print user info to see what Google returns
        print(f"Google user info - email: {email}, first_name: {first_name}, last_name: {last_name}, picture: {picture}, google_id: {google_id}")
        print(f"Available fields in user_info: {list(user_info.keys())}")
        
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
                
                # Always update profile image from Google for Google users
                if picture:
                    user.profile_image = picture
                    updated = True
                    print(f"Updated profile_image for existing user: {picture}")
                
                # Auto-verify OAuth users
                if not user.is_verified:
                    user.is_verified = True
                    updated = True
                
                if updated:
                    db.commit()
                    db.refresh(user)
                    print(f"Updated existing user: {user.email}")
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
                detail=f"Failed to create/update user: {str(db_error)}"
            )
        
        # Verify user was created/retrieved successfully
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve user"
            )
        
        # Generate JWT token
        token = OAuth2.create_access_token(data={"user_id": user.id})
        
        print(f"Google auth successful for user: {user.email}, returning token")
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
            detail=f"An error occurred during Google authentication: {str(e)}"
        )

@router.post("/login")
def login(user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends (get_db)): 
    try:
        getuser = db.query(models.DBUser).filter(models.DBUser.email == user_credentials.username).first()
        if not getuser :
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="this is email not a found ")

        # Check if user is OAuth user (no password)
        if getuser.provider == "google" or not getuser.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was created with Google. Please use Google Sign-In."
            )

        if not utils.verify(user_credentials.password, getuser.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="this is password error")
        
        token = OAuth2.create_access_token(data = {"user_id": getuser.id})

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
            detail=f"Internal server error: {str(e)}"
        )

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
            print(f"Failed to send password reset email: {str(e)}")
            email_sent = False
        
        # Prepare response
        response_data = {
            "message": "If the email exists, a verification code has been sent.",
            "email": request.email
        }
        
        # If email wasn't sent (e.g., SMTP not configured), include code in response for development
        if not email_sent:
            print(f"\n{'='*60}")
            print(f"EMAIL NOT SENT - SMTP not configured")
            print(f"Password reset code for {user.email}: {verification_code}")
            print(f"{'='*60}\n")
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
            detail=f"An error occurred: {str(e)}"
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
            detail=f"An error occurred: {str(e)}"
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
            detail=f"An error occurred: {str(e)}"
        )
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
from fastapi import HTTPException, status
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Email configuration - loaded from environment variables
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)


def send_verification_email(email: str, verification_code: str, first_name: str) -> bool:
    """
    Send verification email with 6-digit code to user
    """
    # Check if SMTP credentials are configured
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        #print("WARNING: SMTP credentials not configured. Email will not be sent.")
        #print(f"Verification code for {email}: {verification_code}")
        #print("Please set SMTP_USERNAME and SMTP_PASSWORD environment variables to enable email sending.")
        # In development, you might want to allow signup to proceed
        # In production, you should raise an exception or use a proper email service
        return False
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = "Email Verification Code"
        
        # Email body
        body = f"""
        Hello {first_name},
        
        Thank you for signing up! Please use the following verification code to activate your account:
        
        Verification Code: {verification_code}
        
        This code will expire in 5 minutes.
        
        If you didn't create an account, please ignore this email.
        
        Best regards,
        Your App Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(FROM_EMAIL, email, text)
        server.quit()
        
        return True
    except Exception as e:
        # Log the error (you can use proper logging here)
        #print(f"Error sending email: {str(e)}")
        # For development, you might want to raise an exception
        # For production, you might want to return False and log the error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {str(e)}"
        )

def send_password_reset_email(email: str, verification_code: str, first_name: str) -> bool:
    """
    Send password reset email with 6-digit code to user
    """
    # Check if SMTP credentials are configured
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        return False
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = "Password Reset Verification Code"
        
        # Email body
        body = f"""
        Hello {first_name},
        
        You requested to reset your password. Please use the following verification code to proceed:
        
        Verification Code: {verification_code}
        
        This code will expire in 10 minutes.
        
        If you didn't request a password reset, please ignore this email and your password will remain unchanged.
        
        Best regards,
        Your App Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(FROM_EMAIL, email, text)
        server.quit()
        
        return True
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send password reset email: {str(e)}"
        )

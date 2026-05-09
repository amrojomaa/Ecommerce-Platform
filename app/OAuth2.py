from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.oauth2 import OAuth2PasswordBearer
from jose import jwt
from app import schemas, models
from sqlalchemy.orm import Session
from app.database import get_db
from typing import Optional


oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/login')

SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 180
REFRESH_TOKEN_EXPIRE_DAYS = 30
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"

def create_access_token(data: dict, token_version: int = 0): #data = used_id + expire
    
    to_encode = data.copy()
    to_encode.update({"token_version": token_version})
    to_encode.update({"token_type": "access"})
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def create_refresh_token(data: dict, token_version: int = 0):
    to_encode = data.copy()
    to_encode.update({"token_version": token_version})
    to_encode.update({"token_type": "refresh"})
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_access_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_type: str = payload.get("token_type", "access")
        if token_type != "access":
            raise credentials_exception
        id: str = payload.get("user_id")
        token_version: int = payload.get("token_version", 0)
        if id is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    token_data = schemas.TokenData(id=id, token_version=token_version)
    if token_data is None:
            raise credentials_exception
    return token_data #TokenData(id=7, token_version=0)


def verify_refresh_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_type: str = payload.get("token_type")
        if token_type != "refresh":
            raise credentials_exception
        id: str = payload.get("user_id")
        token_version: int = payload.get("token_version", 0)
        if id is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception

    token_data = schemas.TokenData(id=id, token_version=token_version)
    if token_data is None:
        raise credentials_exception
    return token_data

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                          detail=f"Could not validate credentials", 
                                          headers={"WWW-Authenticate": "Bearer"})

    token_data = verify_access_token(token, credentials_exception)
    
    # Fetch user from database to validate token version
    user = db.query(models.DBUser).filter(models.DBUser.id == token_data.id).first()
    if user is None:
        raise credentials_exception
    
    # Validate token version - if token version doesn't match, token is invalid
    # Handle None values (for existing users before migration)
    user_token_version = user.token_version if user.token_version is not None else 0
    token_token_version = token_data.token_version if token_data.token_version is not None else 0
    
    if user_token_version != token_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if getattr(user, "is_blocked", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been suspended.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data

    # user = db.query(models.User).filter(models.User.id == token.id).first()


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[schemas.TokenData]:
    """
    Optional authentication - returns TokenData if authenticated, None otherwise.
    Does not raise exception if no token is provided.
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
        token_data = verify_access_token(token, credentials_exception)
        
        # Fetch user from database to validate token version
        user = db.query(models.DBUser).filter(models.DBUser.id == token_data.id).first()
        if user is None:
            return None
        
        # Validate token version
        user_token_version = user.token_version if user.token_version is not None else 0
        token_token_version = token_data.token_version if token_data.token_version is not None else 0
        
        if user_token_version != token_token_version:
            return None

        if getattr(user, "is_blocked", False):
            return None

        # Return token data (same as get_current_user)
        return token_data
    except Exception:
        return None

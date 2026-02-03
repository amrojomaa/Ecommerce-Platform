from fastapi import Depends, HTTPException
from fastapi import HTTPException, status, Depends
from app import OAuth2, models
from sqlalchemy.orm import Session
from app import OAuth2, models
from app.database import get_db


def require_admin(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not an admin of this operation")
    return user
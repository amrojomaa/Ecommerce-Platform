from fastapi import Depends, HTTPException, status
from app import OAuth2, models
from sqlalchemy.orm import Session
from app.database import get_db


def require_admin(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not an admin of this operation")
    return user


def require_employee(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "employee"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not authorized for this operation. Employee or Admin access required.")
    return user


def require_customer(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "employee", "customer"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not authorized for this operation.")
    return user
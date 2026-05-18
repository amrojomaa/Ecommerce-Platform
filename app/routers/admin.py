from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import OAuth2, models


def require_admin(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not an admin of this operation")
    return user


def require_operations_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "operations_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operations Manager access required.",
        )
    return user


def require_admin_or_operations_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "operations_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized for this operation. Admin or Operations Manager access required.",
        )
    return user


def require_support_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "support_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Support Manager access required.",
        )
    return user


def require_admin_or_support_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "support_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized for this operation. Admin or Support Manager access required.",
        )
    return user


def require_warehouse_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role != "warehouse_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Warehouse Manager access required.",
        )
    return user


def require_admin_or_warehouse_manager(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user),
):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "warehouse_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized for this operation. Admin or Warehouse Manager access required.",
        )
    return user


def require_support_agent(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "support_manager", "support_agent"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not authorized for this operation. Support Agent or Manager access required.")
    return user


def require_customer(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "support_manager", "support_agent", "customer"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're not authorized for this operation.")
    return user


def require_driver(db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You're not authorized for this operation. Driver or Admin access required.")
    return user


def require_cashier(db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user.role not in ["admin", "cashier"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized for this operation. Cashier or Admin access required.",
        )
    return user

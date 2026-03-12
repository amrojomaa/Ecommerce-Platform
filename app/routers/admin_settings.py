from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import text
from app.database import get_db
from app.routers.admin import require_admin
from app import models, schemas

router = APIRouter(
    prefix="/admin/settings",
    tags=['Admin Settings']
)


@router.get("/low-stock-threshold", response_model=schemas.LowStockThresholdResponse)
def get_low_stock_threshold(
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Get the current low stock threshold setting"""
    setting = db.query(models.DBAdminSettings).filter(
        models.DBAdminSettings.setting_key == "low_stock_threshold"
    ).first()
    
    # If setting doesn't exist, create it with default value of 10
    if not setting:
        default_setting = models.DBAdminSettings(
            setting_key="low_stock_threshold",
            setting_value="10"
        )
        db.add(default_setting)
        db.commit()
        db.refresh(default_setting)
        return {"threshold": 10}
    
    try:
        threshold = int(setting.setting_value)
        return {"threshold": threshold}
    except ValueError:
        # If value is invalid, reset to default
        setting.setting_value = "10"
        db.commit()
        return {"threshold": 10}


@router.put("/low-stock-threshold", response_model=schemas.LowStockThresholdResponse)
def update_low_stock_threshold(
    threshold_update: schemas.LowStockThresholdUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Update the low stock threshold setting"""
    setting = db.query(models.DBAdminSettings).filter(
        models.DBAdminSettings.setting_key == "low_stock_threshold"
    ).first()
    
    if not setting:
        # Create new setting if it doesn't exist
        setting = models.DBAdminSettings(
            setting_key="low_stock_threshold",
            setting_value=str(threshold_update.threshold)
        )
        db.add(setting)
    else:
        # Update existing setting
        setting.setting_value = str(threshold_update.threshold)
        setting.updated_at = text('now()')
    
    db.commit()
    db.refresh(setting)
    
    return {"threshold": threshold_update.threshold}


# ─── Warehouse Address ────────────────────────────────────────────────────────

DEFAULT_WAREHOUSE_ADDRESS = "Store Warehouse, Amman, Jordan"


@router.get("/warehouse-address", response_model=schemas.WarehouseAddressResponse)
def get_warehouse_address(
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Get the current warehouse address setting"""
    setting = db.query(models.DBAdminSettings).filter(
        models.DBAdminSettings.setting_key == "warehouse_address"
    ).first()

    if not setting:
        default_setting = models.DBAdminSettings(
            setting_key="warehouse_address",
            setting_value=DEFAULT_WAREHOUSE_ADDRESS
        )
        db.add(default_setting)
        db.commit()
        db.refresh(default_setting)
        return {"address": DEFAULT_WAREHOUSE_ADDRESS}

    return {"address": setting.setting_value}


@router.put("/warehouse-address", response_model=schemas.WarehouseAddressResponse)
def update_warehouse_address(
    address_update: schemas.WarehouseAddressUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Update the warehouse address setting"""
    setting = db.query(models.DBAdminSettings).filter(
        models.DBAdminSettings.setting_key == "warehouse_address"
    ).first()

    if not setting:
        setting = models.DBAdminSettings(
            setting_key="warehouse_address",
            setting_value=address_update.address
        )
        db.add(setting)
    else:
        setting.setting_value = address_update.address
        setting.updated_at = text('now()')

    db.commit()
    db.refresh(setting)

    return {"address": address_update.address}

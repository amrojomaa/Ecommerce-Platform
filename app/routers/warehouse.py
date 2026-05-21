"""
Warehouse router — endpoints for Warehouse Staff and Warehouse Manager.

Staff endpoints:
  GET  /warehouse/orders/preparing  — orders in the staff's queue
  GET  /warehouse/orders/packed     — orders staff has already packed
  PATCH /warehouse/orders/{id}/verify — verify individual order items
  GET  /warehouse/orders/{id}/verifications — get verification state for an order
  PATCH /warehouse/orders/{id}/pack  — mark order as packed (all items must be verified)
  POST /warehouse/orders/{id}/report-issue — report a missing/damaged item

Manager endpoints:
  GET  /warehouse/orders/packed-review — packed orders awaiting manager review
  PATCH /warehouse/orders/{id}/approve — mark order as ready_for_pickup
  GET  /warehouse/issues             — all warehouse issues
  PATCH /warehouse/issues/{id}/resolve — resolve an issue
  PATCH /warehouse/products/{id}/stock — update product stock (manager only)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import text
from typing import List
from datetime import datetime, timezone

from ..database import get_db
from .. import models, schemas
from .admin import require_warehouse_staff, require_admin_or_warehouse_manager

router = APIRouter(prefix="/warehouse", tags=["Warehouse"])


# ── Warehouse Staff Endpoints ──────────────────────────────────────────────────

@router.get("/orders/preparing", response_model=List[schemas.AdminOrderResponse])
def get_preparing_orders(
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Get orders with status 'preparing' for warehouse staff to pick & pack."""
    orders = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
            joinedload(models.DBOrder.user),
            joinedload(models.DBOrder.delivery_job)
            .selectinload(models.DBDeliveryJob.photos),
            selectinload(models.DBOrder.warehouse_issues),
        )
        .filter(models.DBOrder.status == "preparing")
        .order_by(models.DBOrder.created_at.asc())
        .all()
    )
    return orders


@router.get("/orders/packed", response_model=List[schemas.AdminOrderResponse])
def get_packed_orders(
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Get orders that have been packed (for staff reference)."""
    orders = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
            joinedload(models.DBOrder.user),
            joinedload(models.DBOrder.delivery_job)
            .selectinload(models.DBDeliveryJob.photos),
        )
        .filter(models.DBOrder.status.in_(["packed", "ready_for_pickup"]))
        .order_by(models.DBOrder.created_at.desc())
        .all()
    )
    return orders


@router.get("/orders/{order_id}/verifications")
def get_order_verifications(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Get verification status for all items in an order."""
    order = db.query(models.DBOrder).filter(models.DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    verifications = (
        db.query(models.DBOrderItemVerification)
        .filter(models.DBOrderItemVerification.order_id == order_id)
        .all()
    )

    # Build a map of order_item_id -> verification
    verification_map = {}
    for v in verifications:
        verification_map[v.order_item_id] = {
            "id": v.id,
            "verified": v.verified,
            "verified_by": v.verified_by,
            "verified_at": v.verified_at.isoformat() if v.verified_at else None,
        }

    return {
        "order_id": order_id,
        "verifications": verification_map,
    }


@router.patch("/orders/{order_id}/verify")
def verify_order_item(
    order_id: int,
    payload: schemas.OrderItemVerificationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Mark an individual order item as verified (or un-verified)."""
    order = db.query(models.DBOrder).filter(models.DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "preparing":
        raise HTTPException(status_code=400, detail="Order is not in 'preparing' status")

    # Verify the order item exists in this order
    order_item = (
        db.query(models.DBOrderItem)
        .filter(
            models.DBOrderItem.id == payload.order_item_id,
            models.DBOrderItem.order_id == order_id,
        )
        .first()
    )
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found in this order")

    # Upsert verification record
    existing = (
        db.query(models.DBOrderItemVerification)
        .filter(
            models.DBOrderItemVerification.order_id == order_id,
            models.DBOrderItemVerification.order_item_id == payload.order_item_id,
        )
        .first()
    )

    if existing:
        existing.verified = payload.verified
        existing.verified_by = current_user.id if payload.verified else None
        existing.verified_at = datetime.now(timezone.utc) if payload.verified else None
    else:
        new_verification = models.DBOrderItemVerification(
            order_id=order_id,
            order_item_id=payload.order_item_id,
            verified=payload.verified,
            verified_by=current_user.id if payload.verified else None,
            verified_at=datetime.now(timezone.utc) if payload.verified else None,
        )
        db.add(new_verification)

    db.commit()
    return {"message": "Item verification updated", "verified": payload.verified}


@router.patch("/orders/{order_id}/pack")
def pack_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Mark order as 'packed'. All items must be verified first."""
    order = (
        db.query(models.DBOrder)
        .options(selectinload(models.DBOrder.orderitems))
        .filter(models.DBOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "preparing":
        raise HTTPException(status_code=400, detail="Order is not in 'preparing' status")

    # Check all items are verified
    order_item_ids = [item.id for item in order.orderitems]
    verified_count = (
        db.query(models.DBOrderItemVerification)
        .filter(
            models.DBOrderItemVerification.order_id == order_id,
            models.DBOrderItemVerification.order_item_id.in_(order_item_ids),
            models.DBOrderItemVerification.verified == True,
        )
        .count()
    )

    if verified_count < len(order_item_ids):
        raise HTTPException(
            status_code=400,
            detail=f"All items must be verified before packing. {verified_count}/{len(order_item_ids)} verified.",
        )

    # Check for unresolved warehouse issues
    open_issues_count = (
        db.query(models.DBWarehouseIssue)
        .filter(
            models.DBWarehouseIssue.order_id == order_id,
            models.DBWarehouseIssue.status == "open",
        )
        .count()
    )
    if open_issues_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot pack order. There are unresolved warehouse issues that must be resolved by the warehouse manager first.",
        )

    order.status = "packed"
    db.commit()
    return {"message": "Order marked as packed", "order_id": order_id, "status": "packed"}


@router.post("/orders/{order_id}/report-issue", response_model=schemas.WarehouseIssueResponse)
def report_issue(
    order_id: int,
    payload: schemas.WarehouseIssueCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_warehouse_staff),
):
    """Report a missing or damaged item for a specific order."""
    order = db.query(models.DBOrder).filter(models.DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if payload.order_item_id:
        item_exists = (
            db.query(models.DBOrderItem)
            .filter(
                models.DBOrderItem.id == payload.order_item_id,
                models.DBOrderItem.order_id == order_id,
            )
            .first()
        )
        if not item_exists:
            raise HTTPException(status_code=404, detail="Order item not found in this order")

    issue = models.DBWarehouseIssue(
        order_id=order_id,
        order_item_id=payload.order_item_id,
        issue_type=payload.issue_type,
        description=payload.description,
        reported_by=current_user.id,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


# ── Warehouse Manager Endpoints ───────────────────────────────────────────────

@router.get("/orders/packed-review", response_model=List[schemas.AdminOrderResponse])
def get_packed_orders_for_review(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_warehouse_manager),
):
    """Get packed orders awaiting manager approval."""
    orders = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
            joinedload(models.DBOrder.user),
            joinedload(models.DBOrder.delivery_job)
            .selectinload(models.DBDeliveryJob.photos),
        )
        .filter(models.DBOrder.status == "packed")
        .order_by(models.DBOrder.created_at.asc())
        .all()
    )
    return orders


@router.patch("/orders/{order_id}/approve")
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_warehouse_manager),
):
    """Approve a packed order — transitions to ready_for_pickup."""
    order = db.query(models.DBOrder).filter(models.DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "packed":
        raise HTTPException(status_code=400, detail="Order is not in 'packed' status")

    order.status = "ready_for_pickup"
    db.commit()
    return {"message": "Order approved and ready for pickup", "order_id": order_id, "status": "ready_for_pickup"}


@router.get("/issues", response_model=List[schemas.WarehouseIssueResponse])
def get_all_issues(
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_warehouse_manager),
):
    """Get all warehouse issues (optionally filtered by status)."""
    query = db.query(models.DBWarehouseIssue)
    if status_filter:
        query = query.filter(models.DBWarehouseIssue.status == status_filter)
    return query.order_by(models.DBWarehouseIssue.created_at.desc()).all()


@router.patch("/issues/{issue_id}/resolve", response_model=schemas.WarehouseIssueResponse)
def resolve_issue(
    issue_id: int,
    payload: schemas.WarehouseIssueResolve,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_warehouse_manager),
):
    """Resolve a warehouse issue."""
    issue = db.query(models.DBWarehouseIssue).filter(models.DBWarehouseIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status == "resolved":
        raise HTTPException(status_code=400, detail="Issue is already resolved")

    issue.status = "resolved"
    issue.resolved_by = current_user.id
    issue.resolved_at = datetime.now(timezone.utc)
    issue.resolution_note = payload.resolution_note
    db.commit()
    db.refresh(issue)
    return issue


@router.patch("/products/{product_id}/stock")
def update_product_stock(
    product_id: int,
    payload: schemas.ProductStockUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_warehouse_manager),
):
    """Update only the stock quantity of a product (Warehouse Manager only)."""
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.quantity = payload.quantity
    db.commit()
    return {"message": "Stock updated", "product_id": product_id, "quantity": payload.quantity}

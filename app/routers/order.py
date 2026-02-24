from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from app import models, schemas
from app import OAuth2
from app.routers.admin import require_admin



router = APIRouter(
    # prefix="/users",
    tags=['Odrer']
)

@router.post("/checkout", response_model=schemas.OrderResponse)
def checkout(db: Session = Depends(get_db), current_user  = Depends(OAuth2.get_current_user)):

    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    

    # grand_total = cart.grand_total

    new_order = models.DBOrder(user_id=current_user.id, total_amount=cart.grand_total)
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for item in cart.items:
        db.add(models.DBOrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=float(item.product.price),
            total=item.total
        ))

        # item.product.quantity -= item.quantity

    # db.query(models.DBCartItem).filter(models.DBCartItem.cart_id == cart.id).delete()
    db.commit()

    # return {
    # "items": new_order.orderitems,
    # "total_amount": new_order.total_amount}
    return new_order



@router.get("/orders/my", response_model=List[schemas.OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(OAuth2.get_current_user)
):
    orders = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product)
        )
        .filter(models.DBOrder.user_id == current_user.id)
        .order_by(models.DBOrder.created_at.desc())
        .all()
    )

    return orders


@router.patch("/orders/{order_id}/cancel", response_model=schemas.OrderResponse)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(OAuth2.get_current_user)
):
    """Cancel an order (sets status to cancelled instead of deleting)"""
    order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product)
        )
        .filter(
            models.DBOrder.id == order_id,
            models.DBOrder.user_id == current_user.id
        )
        .first()
    )
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Set status to cancelled instead of deleting
    order.status = "cancelled"
    db.commit()
    db.refresh(order)
    
    return order


@router.get("/orders/all", response_model=List[schemas.AdminOrderResponse])
def get_all_orders(
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Get all orders (Admin only)"""
    orders = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product),
            joinedload(models.DBOrder.user)
        )
        .order_by(models.DBOrder.created_at.desc())
        .all()
    )
    
    return orders


@router.patch("/orders/{order_id}/status", response_model=schemas.AdminOrderResponse)
def update_order_status(
    order_id: int,
    status_update: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Update order status (Admin only)
    
    Allowed transitions:
    - paid → shipped
    - shipped → delivered
    - any status → cancelled
    """
    # Validate status value
    valid_statuses = ["created", "paid", "shipped", "delivered", "cancelled"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Allowed values: {', '.join(valid_statuses)}"
        )
    
    order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product),
            joinedload(models.DBOrder.user)
        )
        .filter(models.DBOrder.id == order_id)
        .first()
    )
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Validate status transition rules
    current_status = order.status
    new_status = status_update.status
    
    # Allow cancellation from any status
    if new_status == "cancelled":
        order.status = new_status
    # Allow paid → shipped
    elif current_status == "paid" and new_status == "shipped":
        order.status = new_status
    # Allow shipped → delivered
    elif current_status == "shipped" and new_status == "delivered":
        order.status = new_status
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions: paid→shipped, shipped→delivered, any→cancelled"
        )
    
    db.commit()
    db.refresh(order)
    
    return order

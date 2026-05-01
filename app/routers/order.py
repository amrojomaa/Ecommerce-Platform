from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from app import models, schemas
from app import OAuth2
from app.routers.admin import require_admin


def get_order_item_with_images(order_item: models.DBOrderItem) -> dict:
    """Helper function to convert DBOrderItem to dict with product images"""
    images = []
    if order_item.product and hasattr(order_item.product, 'images') and order_item.product.images:
        images = [img.image_path for img in order_item.product.images]
    
    return {
        "id": order_item.id,
        "product": {
            "name": order_item.product.name if order_item.product else "Product",
            "images": images
        },
        "quantity": order_item.quantity,
        "price": float(order_item.price),
        "total": float(order_item.total)
    }



router = APIRouter(
    # prefix="/users",
    tags=['Odrer']
)

@router.post("/checkout", response_model=schemas.OrderResponse)
def checkout(checkout_data: schemas.CheckoutRequest = None, db: Session = Depends(get_db), current_user  = Depends(OAuth2.get_current_user)):

    if checkout_data:
        user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
        if user:
            user.street = checkout_data.address
            user.city = checkout_data.city
            if checkout_data.country:
                user.country = checkout_data.country
            if checkout_data.phone:
                user.phone = checkout_data.phone
            db.commit()

    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    
    # Check if there's an existing order with status "created"
    existing_order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images)
        )
        .filter(
            models.DBOrder.user_id == current_user.id,
            models.DBOrder.status == "created"
        )
        .first()
    )

    if existing_order:
        # Add items to existing order
        cart_total = 0
        for item in cart.items:
            # Check if order item with same product_id already exists
            existing_order_item = (
                db.query(models.DBOrderItem)
                .filter(
                    models.DBOrderItem.order_id == existing_order.id,
                    models.DBOrderItem.product_id == item.product_id
                )
                .first()
            )
            
            if existing_order_item:
                # Update existing order item: add quantities and recalculate total
                existing_order_item.quantity += item.quantity
                existing_order_item.total = float(existing_order_item.price * existing_order_item.quantity)
                cart_total += item.total
            else:
                # Create new order item
                db.add(models.DBOrderItem(
                    order_id=existing_order.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    price=float(item.product.final_price),
                    total=item.total
                ))
                cart_total += item.total
        
        # Update order total amount
        existing_order.total_amount += cart_total
        db.commit()
        
        # Reload order with orderitems for response
        existing_order = (
            db.query(models.DBOrder)
            .options(
                selectinload(models.DBOrder.orderitems)
                .joinedload(models.DBOrderItem.product)
                .selectinload(models.DBProduct.images)
            )
            .filter(models.DBOrder.id == existing_order.id)
            .first()
        )
        
        return existing_order
    else:
        # Create new order
        new_order = models.DBOrder(user_id=current_user.id, total_amount=cart.grand_total)
        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        for item in cart.items:
            db.add(models.DBOrderItem(
                order_id=new_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=float(item.product.final_price),
                total=item.total
            ))

        # item.product.quantity -= item.quantity

        # db.query(models.DBCartItem).filter(models.DBCartItem.cart_id == cart.id).delete()
        db.commit()
        
        # Load order items for response
        db.refresh(new_order)
        new_order = (
            db.query(models.DBOrder)
            .options(
                selectinload(models.DBOrder.orderitems)
                .joinedload(models.DBOrderItem.product)
                .selectinload(models.DBProduct.images)
            )
            .filter(models.DBOrder.id == new_order.id)
            .first()
        )

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
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images)
        )
        .filter(models.DBOrder.user_id == current_user.id)
        .order_by(models.DBOrder.created_at.desc())
        .all()
    )
    
    # Convert orders to response format with product images
    result = []
    for order in orders:
        order_dict = {
            "id": order.id,
            "created_at": order.created_at,
            "total_amount": order.total_amount,
            "status": order.status,
            "orderitems": [get_order_item_with_images(item) for item in order.orderitems]
        }
        result.append(order_dict)
    
    return result


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
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images)
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
    
    # Only allow cancellation if order status is "created"
    if order.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already cancelled"
        )
    
    if order.status != "created":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order with status '{order.status}'. Only orders with status 'created' can be cancelled."
        )
    
    # Set status to cancelled (no stock to restore since status is "created")
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
    try:
        orders = (
            db.query(models.DBOrder)
            .options(
                selectinload(models.DBOrder.orderitems)
                .joinedload(models.DBOrderItem.product)
                .selectinload(models.DBProduct.images),
                joinedload(models.DBOrder.user),
                joinedload(models.DBOrder.cashier),
                joinedload(models.DBOrder.delivery_job)
                .selectinload(models.DBDeliveryJob.photos)
            )
            .order_by(models.DBOrder.created_at.desc())
            .all()
        )
        
        return orders
    except Exception as e:
        import traceback
        print(f"Error in get_all_orders: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching orders: {str(e)}"
        )


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
    valid_statuses = ["created", "paid", "shipped", "delivered", "cancelled", "assigned", "picked_up", "delivering"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Allowed values: {', '.join(valid_statuses)}"
        )
    
    order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
            joinedload(models.DBOrder.user),
            joinedload(models.DBOrder.delivery_job)
            .selectinload(models.DBDeliveryJob.photos)
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
    
    # Handle stock changes based on status transitions
    # If changing to paid (from created or cancelled), decrease stock
    if new_status == "paid" and current_status != "paid":
        # Check stock availability first
        for order_item in order.orderitems:
            product = order_item.product
            if product.quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product {product.name}. Available: {product.quantity}, Requested: {order_item.quantity}"
                )
        # Decrease stock
        for order_item in order.orderitems:
            product = order_item.product
            product.quantity -= order_item.quantity
        order.status = new_status
        for order_item in order.orderitems:
            db.add(
                models.DBUserInteraction(
                    user_id=order.user_id,
                    product_id=order_item.product_id,
                    event_type=models.InteractionEventType.PURCHASE,
                    query_text=None,
                )
            )
        db.query(models.DBRecommendationBatchCache).filter(
            models.DBRecommendationBatchCache.user_id == order.user_id
        ).delete()
    # If changing to cancelled from paid or delivery states, restore stock
    elif new_status == "cancelled" and current_status in ["paid", "shipped", "delivered", "assigned", "picked_up", "delivering"]:
        for order_item in order.orderitems:
            product = order_item.product
            product.quantity += order_item.quantity
        order.status = new_status
        # Handle delivery job cancellation if any
        delivery_job = db.query(models.DBDeliveryJob).filter(models.DBDeliveryJob.order_id == order.id).first()
        if delivery_job and delivery_job.status not in ["delivered", "cancelled"]:
            from app.routers.delivery import _clear_issue_report
            _clear_issue_report(db, delivery_job)
            delivery_job.status = "cancelled"
    # Allow cancellation from created status (no stock to restore)
    elif new_status == "cancelled" and current_status == "created":
        order.status = new_status
    # Allow paid → shipped
    elif current_status == "paid" and new_status == "shipped":
        order.status = new_status
    # Allow shipped → delivered
    elif current_status == "shipped" and new_status == "delivered":
        order.status = new_status
    # Allow assigned → picked_up → delivering → delivered (these are usually handled via delivery module but just in case)
    elif current_status == "assigned" and new_status == "picked_up":
        order.status = new_status
    elif current_status == "picked_up" and new_status == "delivering":
        order.status = new_status
    elif current_status == "delivering" and new_status == "delivered":
        order.status = new_status
    # Allow picked_up -> delivered directly (some drivers might skip delivering status)
    elif current_status == "picked_up" and new_status == "delivered":
        order.status = new_status
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions: created→paid, paid→shipped, shipped→delivered, any→cancelled"
        )
    
    db.commit()
    db.refresh(order)
    
    # If order is paid, create a delivery job
    if new_status == "paid" and getattr(order, "sale_channel", None) != "pos":
        from app.routers.delivery import internal_create_delivery_job
        internal_create_delivery_job(order.id, db)
    
    return order

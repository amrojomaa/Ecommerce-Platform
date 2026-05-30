from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from .. import models, schemas
from .. import OAuth2
from .admin import require_admin_or_operations_manager, require_seller, require_order_status_updater
from app.services import promotion_engine


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


def _build_promotion_line_items(cart_items: List[models.DBCartItem]) -> list[promotion_engine.PromotionLineItem]:
    lines: list[promotion_engine.PromotionLineItem] = []
    for item in cart_items:
        unit_price = float(item.product.final_price)
        quantity = int(item.quantity)
        lines.append(
            promotion_engine.PromotionLineItem(
                product_id=item.product_id,
                product_name=item.product.name,
                category_name=item.product.category_name,
                quantity=quantity,
                unit_price=unit_price,
                line_total=round(unit_price * quantity, 2),
            )
        )
    return lines


def _build_promotion_line_items_from_order_items(order_items: List[models.DBOrderItem]) -> list[promotion_engine.PromotionLineItem]:
    lines: list[promotion_engine.PromotionLineItem] = []
    for item in order_items:
        if not item.product:
            continue
        unit_price = float(item.product.final_price)
        quantity = int(item.quantity)
        lines.append(
            promotion_engine.PromotionLineItem(
                product_id=item.product_id,
                product_name=item.product.name,
                category_name=item.product.category_name,
                quantity=quantity,
                unit_price=unit_price,
                line_total=round(unit_price * quantity, 2),
            )
        )
    return lines


def _normalize_shipping_text(value: str | None) -> str:
    return str(value or "").strip().lower()


def _build_order_metadata(checkout_data: schemas.CheckoutRequest, shipping_fee: float) -> dict:
    return {
        "shipping_address": {
            "address": checkout_data.address or "",
            "city": checkout_data.city or "",
            "state": checkout_data.state or "",
            "zipCode": checkout_data.zipCode or "",
            "country": checkout_data.country or "",
            "phone": checkout_data.phone or "",
        },
        "shipping_region": checkout_data.shipping_region,
        "shipping_fee": shipping_fee,
    }


def _shipping_metadata_matches(existing_metadata: dict | None, checkout_data: schemas.CheckoutRequest) -> bool:
    if not existing_metadata or not checkout_data:
        return False

    existing_address = existing_metadata.get("shipping_address") or {}
    compare_fields = [
        ("address", checkout_data.address),
        ("city", checkout_data.city),
        ("state", checkout_data.state),
        ("zipCode", checkout_data.zipCode),
        ("country", checkout_data.country),
        ("phone", checkout_data.phone),
    ]

    for field, incoming_value in compare_fields:
        if _normalize_shipping_text(existing_address.get(field)) != _normalize_shipping_text(incoming_value):
            return False

    existing_region = _normalize_shipping_text(existing_metadata.get("shipping_region"))
    incoming_region = _normalize_shipping_text(checkout_data.shipping_region)
    return existing_region == incoming_region


def _load_order_with_items(db: Session, order_id: int) -> models.DBOrder | None:
    return (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images)
        )
        .filter(models.DBOrder.id == order_id)
        .first()
    )


def _merge_cart_into_order(db: Session, order: models.DBOrder, cart: models.DBCart) -> None:
    """Add only net-new cart quantities to an existing order; keep cart items intact."""
    existing_items = {
        item.product_id: item
        for item in order.orderitems
    }

    for cart_item in cart.items:
        unit_price = float(cart_item.product.final_price)
        cart_qty = int(cart_item.quantity)
        existing_item = existing_items.get(cart_item.product_id)

        if existing_item:
            add_qty = max(0, cart_qty - int(existing_item.quantity))
            if add_qty == 0:
                continue
            existing_item.quantity = int(existing_item.quantity) + add_qty
            existing_item.price = unit_price
            existing_item.total = round(unit_price * int(existing_item.quantity), 2)
        else:
            new_item = models.DBOrderItem(
                order_id=order.id,
                product_id=cart_item.product_id,
                quantity=cart_qty,
                price=unit_price,
                total=round(unit_price * cart_qty, 2),
            )
            db.add(new_item)
            existing_items[cart_item.product_id] = new_item


def _apply_promotion_and_shipping(
    db: Session,
    order: models.DBOrder,
    shipping_fee: float,
    order_metadata: dict | None,
) -> None:
    db.flush()
    db.refresh(order)
    order = _load_order_with_items(db, order.id)
    if not order:
        return

    promotion_summary = promotion_engine.calculate_promotion_totals(
        _build_promotion_line_items_from_order_items(order.orderitems),
        promotion_engine.get_active_promotion(db),
    )

    order.total_amount = float(promotion_summary["grand_total"]) + shipping_fee
    order.promotion_discount = float(promotion_summary["promotion_discount"])
    order.promotion_name = (
        promotion_summary["applied_promotion"]["name"]
        if promotion_summary["applied_promotion"]
        else None
    )
    if order_metadata is not None:
        order.order_metadata = order_metadata



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

    promotion_summary = promotion_engine.calculate_promotion_totals(
        _build_promotion_line_items(cart.items),
        promotion_engine.get_active_promotion(db),
    )
    
    shipping_fee = float(checkout_data.shipping_fee or 0.0) if checkout_data else 0.0
    order_metadata = _build_order_metadata(checkout_data, shipping_fee) if checkout_data else None
    merged = False

    existing_created_order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
        )
        .filter(
            models.DBOrder.user_id == current_user.id,
            models.DBOrder.status == "created",
            models.DBOrder.sale_channel == "online",
        )
        .order_by(models.DBOrder.created_at.desc())
        .first()
    )

    if (
        checkout_data
        and existing_created_order
        and _shipping_metadata_matches(existing_created_order.order_metadata, checkout_data)
    ):
        _merge_cart_into_order(db, existing_created_order, cart)
        _apply_promotion_and_shipping(db, existing_created_order, shipping_fee, order_metadata)
        db.commit()
        target_order = _load_order_with_items(db, existing_created_order.id)
        if not target_order:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update order")
        target_order.merged = True
        return target_order

    new_order = models.DBOrder(
        user_id=current_user.id,
        total_amount=float(promotion_summary["grand_total"]) + shipping_fee,
        promotion_discount=float(promotion_summary["promotion_discount"]),
        promotion_name=(
            promotion_summary["applied_promotion"]["name"]
            if promotion_summary["applied_promotion"]
            else None
        ),
        order_metadata=order_metadata,
    )
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

    db.commit()
    
    new_order = _load_order_with_items(db, new_order.id)
    if not new_order:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create order")

    new_order.merged = merged
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
        ship_meta = order.order_metadata or {}
        ship = ship_meta.get("shipping_address") or {}
        delivery_address = ", ".join(
            part for part in [ship.get("address"), ship.get("city"), ship.get("country")] if part
        )
        order_dict = {
            "id": order.id,
            "created_at": order.created_at,
            "total_amount": order.total_amount,
            "promotion_discount": float(order.promotion_discount or 0),
            "promotion_name": order.promotion_name,
            "status": order.status,
            "delivery_address": delivery_address or None,
            "orderitems": [get_order_item_with_images(item) for item in order.orderitems]
        }
        result.append(order_dict)
    
    return result


@router.get("/orders/seller", response_model=List[schemas.AdminOrderResponse])
def get_seller_orders(
    db: Session = Depends(get_db),
    current_user = Depends(require_seller)
):
    """Get orders relevant to the seller (paid, preparing)."""
    try:
        orders = (
            db.query(models.DBOrder)
            .options(
                selectinload(models.DBOrder.orderitems)
                .joinedload(models.DBOrderItem.product)
                .selectinload(models.DBProduct.images),
                joinedload(models.DBOrder.user),
                joinedload(models.DBOrder.delivery_job)
                .selectinload(models.DBDeliveryJob.photos)
            )
            .filter(
                models.DBOrder.status != "created",
                models.DBOrder.sale_channel != "pos"
            )
            .order_by(models.DBOrder.created_at.desc())
            .all()
        )
        return orders
    except Exception as e:
        import traceback
        print(f"Error in get_seller_orders: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching seller orders: {str(e)}"
        )


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
    current_user = Depends(require_admin_or_operations_manager)
):
    """Get all orders (Admin / Operations Manager)."""
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
    current_user = Depends(require_order_status_updater)
):
    """Update order status (Admin / Operations Manager / Seller)
    
    Allowed transitions:
    - paid → preparing (Seller)
    - paid → shipped
    - preparing → packed (Warehouse Staff)
    - packed → ready_for_pickup (Warehouse Manager)
    - ready_for_pickup → shipped
    - shipped → delivered
    - any status → cancelled
    """
    # Validate status value
    valid_statuses = ["created", "paid", "preparing", "packed", "ready_for_pickup", "shipped", "delivered", "cancelled", "assigned", "picked_up", "delivering"]
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
    
    # Prevent preparation of POS orders
    if order.sale_channel == "pos" and status_update.status == "preparing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="POS orders are processed on-site and cannot be marked as preparing."
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
    # If changing to cancelled from paid or delivery/warehouse states, restore stock
    elif new_status == "cancelled" and current_status in ["paid", "shipped", "delivered", "assigned", "picked_up", "delivering", "preparing", "packed", "ready_for_pickup"]:
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
    # Warehouse flow: paid → preparing (Seller action)
    elif current_status == "paid" and new_status == "preparing":
        order.status = new_status
    # Warehouse flow: preparing → packed (Warehouse Staff action)
    elif current_status == "preparing" and new_status == "packed":
        order.status = new_status
    # Warehouse flow: packed → ready_for_pickup (Warehouse Manager action)
    elif current_status == "packed" and new_status == "ready_for_pickup":
        order.status = new_status
    # Allow ready_for_pickup → shipped
    elif current_status == "ready_for_pickup" and new_status == "shipped":
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

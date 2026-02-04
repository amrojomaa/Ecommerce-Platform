from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2



router = APIRouter(
    # prefix="/users",
    tags=['Odrer']
)

@router.post("/checkout", response_model=schemas.OrderResponse)
def checkout(db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):

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

    return {
    "items": new_order.orderitems,
    "total_amount": new_order.total_amount}
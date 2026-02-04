from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2
from sqlalchemy.sql import exists



router = APIRouter(
    # prefix="/users",
    tags=['Cart']
)


@router.post("/addtocart", response_model=schemas.Updateoutputcart)
def add_to_cart(request :schemas.AddCart, db: Session = Depends (get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    product = db.query(models.DBProduct).filter(models.DBProduct.name == request.product_name).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart:
        cart = models.DBCart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)

    cart_item = db.query(models.DBCartItem).filter(
        models.DBCartItem.cart_id == cart.id,
        models.DBCartItem.product_id == product.id).first()
    
    if (product.quantity < (request.quantity+cart_item.quantity)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Not enough stock available")
    
    if cart_item:
        cart_item.quantity += request.quantity
    else:
        cart_item = models.DBCartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=request.quantity
        )
        db.add(cart_item)
    # product.quantity -= request.quantity
    db.commit()
    db.refresh(cart_item)
    # raise HTTPException(status_code=status.HTTP_200_OK, detail="add to cart succsessfully")
    return cart_item


@router.get("/showmecart", response_model=schemas.CartResponse)
def show_me_cart(db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):

    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    
    # cart_items = db.query(models.DBCartItem).filter(models.DBCartItem.cart_id == cart.id).all()
    
    if not cart.items:
        return []

    # result = []

    # for item in cart.items:
    #     result.append({
    #         "product_id": item.product.id,
    #         "product_name": item.product.name,
    #         "price": float(item.product.price),
    #         "quantity": item.quantity,
    #         "total": float(item.product.price * item.quantity)
    #     })

    return {
        "items": cart.items,
        "grand_total": cart.grand_total
    }


@router.put("/updatecart/{item_id}", response_model=schemas.Updateoutputcart)
def update_cart(item_id: int, request :schemas.Updateinputcart, db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    cartitem  = db.query(models.DBCartItem).join(models.DBCart).filter(models.DBCartItem.id == item_id, models.DBCart.user_id == current_user.id).first()
    if not cartitem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    
    if (cartitem.product.quantity < request.quantity):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Not enough stock available")
    
    cartitem.quantity = request.quantity
    db.commit()
    db.refresh(cartitem)
    return cartitem

@router.delete("/deletecart/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart(item_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    cartitem  = db.query(models.DBCartItem).join(models.DBCart).filter(models.DBCartItem.id == item_id, models.DBCart.user_id == current_user.id).first()
    if not cartitem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    
    # cartitem.delete(synchronize_session=False)
    db.delete(cartitem)
    db.commit()

@router.delete("/clearcart/{Cart_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(Cart_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    cart  = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id, models.DBCart.id == Cart_id).first()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    
    items = db.query(models.DBCartItem).filter(models.DBCartItem.cart_id == Cart_id)
    if not items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart is empty")
    items.delete(synchronize_session=False)
    # db.delete(items)
    db.commit()


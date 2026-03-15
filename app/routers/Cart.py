from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2


def get_cart_item_with_images(cart_item: models.DBCartItem) -> dict:
    """Helper function to convert DBCartItem to dict with product images"""
    return {
        "id": cart_item.id,
        "quantity": cart_item.quantity,
        "total": float(cart_item.total),
        "product": {
            "name": cart_item.product.name,
            "price": float(cart_item.product.price),
            "images": [img.image_path for img in cart_item.product.images]
        }
    }


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

    
    if cart_item:
        if (product.quantity < (request.quantity+cart_item.quantity)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Not enough stock available")
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
    
    # Return cart item with product images
    return {
        "product": {
            "name": cart_item.product.name,
            "price": float(cart_item.product.price),
            "images": [img.image_path for img in cart_item.product.images]
        },
        "quantity": cart_item.quantity,
        "total": float(cart_item.total)
    }


@router.get("/showmecart", response_model=schemas.CartResponse)
def show_me_cart(db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):

    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    
    if not cart.items:
        return {
            "items": [],
            "grand_total": 0.0
        }

    # Convert cart items to include product images
    cart_items = [get_cart_item_with_images(item) for item in cart.items]

    return {
        "items": cart_items,
        "grand_total": float(cart.grand_total)
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
    
    # Return cart item with product images
    return {
        "product": {
            "name": cartitem.product.name,
            "price": float(cartitem.product.price),
            "images": [img.image_path for img in cartitem.product.images]
        },
        "quantity": cartitem.quantity,
        "total": float(cartitem.total)
    }

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")
    items.delete(synchronize_session=False)
    # db.delete(items)
    db.commit()


@router.delete("/clearcart", status_code=status.HTTP_204_NO_CONTENT)
def clear_current_user_cart(db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
    if not cart:
        return None

    db.query(models.DBCartItem).filter(models.DBCartItem.cart_id == cart.id).delete(synchronize_session=False)
    db.commit()
    return None

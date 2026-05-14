from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2
from app.services import promotion_engine


def get_cart_item_with_images(cart_item: models.DBCartItem) -> dict:
    """Helper function to convert DBCartItem to dict with product images"""
    original_price = float(cart_item.product.price)
    discounted_price = float(cart_item.product.final_price)
    has_discount = discounted_price < original_price
    return {
        "id": cart_item.id,
        "quantity": cart_item.quantity,
        "total": float(cart_item.total),
        "product": {
            "name": cart_item.product.name,
            "name_ar": cart_item.product.name_ar,
            "name_fr": cart_item.product.name_fr,
            "price": discounted_price,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_enabled": bool(cart_item.product.discount_enabled),
            "has_discount": has_discount,
            "category_name": cart_item.product.category_name,
            "category_name_ar": cart_item.product.category.name_ar if cart_item.product.category else None,
            "category_name_fr": cart_item.product.category.name_fr if cart_item.product.category else None,
            "description": cart_item.product.description,
            "description_ar": cart_item.product.description_ar,
            "description_fr": cart_item.product.description_fr,
            "images": [img.image_path for img in cart_item.product.images]
        }
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


def _get_cart_totals(db: Session, cart_items: List[models.DBCartItem]) -> dict:
    active_promotion = promotion_engine.get_active_promotion(db)
    promotion_summary = promotion_engine.calculate_promotion_totals(
        _build_promotion_line_items(cart_items),
        active_promotion,
    )
    return {
        "subtotal": float(promotion_summary["subtotal"]),
        "promotion_discount": float(promotion_summary["promotion_discount"]),
        "applied_promotion": promotion_summary["applied_promotion"],
        "grand_total": float(promotion_summary["grand_total"])
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
    original_price = float(cart_item.product.price)
    discounted_price = float(cart_item.product.final_price)
    has_discount = discounted_price < original_price
    return {
        "product": {
            "name": cart_item.product.name,
            "name_ar": cart_item.product.name_ar,
            "name_fr": cart_item.product.name_fr,
            "price": discounted_price,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_enabled": bool(cart_item.product.discount_enabled),
            "has_discount": has_discount,
            "category_name": cart_item.product.category_name,
            "category_name_ar": cart_item.product.category.name_ar if cart_item.product.category else None,
            "category_name_fr": cart_item.product.category.name_fr if cart_item.product.category else None,
            "description": cart_item.product.description,
            "description_ar": cart_item.product.description_ar,
            "description_fr": cart_item.product.description_fr,
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
            "subtotal": 0.0,
            "promotion_discount": 0.0,
            "applied_promotion": None,
            "grand_total": 0.0
        }

    # Convert cart items to include product images
    cart_items = [get_cart_item_with_images(item) for item in cart.items]
    totals = _get_cart_totals(db, cart.items)

    return {
        "items": cart_items,
        **totals
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
    db.refresh(cartitem.cart)
    totals = _get_cart_totals(db, cartitem.cart.items)
    
    # Return cart item with product images
    original_price = float(cartitem.product.price)
    discounted_price = float(cartitem.product.final_price)
    has_discount = discounted_price < original_price
    return {
        "product": {
            "name": cartitem.product.name,
            "name_ar": cartitem.product.name_ar,
            "name_fr": cartitem.product.name_fr,
            "price": discounted_price,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_enabled": bool(cartitem.product.discount_enabled),
            "has_discount": has_discount,
            "category_name": cartitem.product.category_name,
            "category_name_ar": cartitem.product.category.name_ar if cartitem.product.category else None,
            "category_name_fr": cartitem.product.category.name_fr if cartitem.product.category else None,
            "description": cartitem.product.description,
            "description_ar": cartitem.product.description_ar,
            "description_fr": cartitem.product.description_fr,
            "images": [img.image_path for img in cartitem.product.images]
        },
        "quantity": cartitem.quantity,
        "total": float(cartitem.total),
        **totals
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


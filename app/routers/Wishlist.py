from typing import List
from fastapi import HTTPException, status, Depends
from fastapi import APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2


def get_wishlist_item_with_images(wishlist_item: models.DBWishlistItem) -> dict:
    """Helper function to convert DBWishlistItem to dict with product images"""
    original_price = float(wishlist_item.product.price)
    discounted_price = float(wishlist_item.product.final_price)
    has_discount = discounted_price < original_price
    return {
        "id": wishlist_item.id,
        "product": {
            "name": wishlist_item.product.name,
            "price": discounted_price,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_enabled": bool(wishlist_item.product.discount_enabled),
            "has_discount": has_discount,
            "category_name": wishlist_item.product.category_name,
            "description": wishlist_item.product.description,
            "images": [img.image_path for img in wishlist_item.product.images]
        }
    }


router = APIRouter(
    tags=['Wishlist']
)


@router.post("/addtowishlist", response_model=schemas.WishlistItemOut)
def add_to_wishlist(request: schemas.AddWishlist, db: Session = Depends(get_db), 
                    current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    product = db.query(models.DBProduct).filter(models.DBProduct.name == request.product_name).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    wishlist = db.query(models.DBWishlist).filter(models.DBWishlist.user_id == current_user.id).first()
    if not wishlist:
        wishlist = models.DBWishlist(user_id=current_user.id)
        db.add(wishlist)
        db.commit()
        db.refresh(wishlist)

    # Check if product already exists in wishlist
    wishlist_item = db.query(models.DBWishlistItem).filter(
        models.DBWishlistItem.wishlist_id == wishlist.id,
        models.DBWishlistItem.product_id == product.id).first()
    
    if wishlist_item:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                          detail="Product already in wishlist")
    
    wishlist_item = models.DBWishlistItem(
        wishlist_id=wishlist.id,
        product_id=product.id
    )
    db.add(wishlist_item)
    db.commit()
    db.refresh(wishlist_item)
    
    return get_wishlist_item_with_images(wishlist_item)


@router.get("/showmewishlist", response_model=schemas.WishlistResponse)
def show_me_wishlist(db: Session = Depends(get_db), 
                     current_user: schemas.User = Depends(OAuth2.get_current_user)):

    wishlist = db.query(models.DBWishlist).filter(models.DBWishlist.user_id == current_user.id).first()
    if not wishlist:
        return {
            "items": []
        }
    
    if not wishlist.items:
        return {
            "items": []
        }

    # Convert wishlist items to include product images
    wishlist_items = [get_wishlist_item_with_images(item) for item in wishlist.items]

    return {
        "items": wishlist_items
    }


@router.delete("/deletewishlist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_item(item_id: int, db: Session = Depends(get_db), 
                         current_user: schemas.User = Depends(OAuth2.get_current_user)):
    
    wishlist_item = db.query(models.DBWishlistItem).join(models.DBWishlist).filter(
        models.DBWishlistItem.id == item_id, 
        models.DBWishlist.user_id == current_user.id).first()
    if not wishlist_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
    
    db.delete(wishlist_item)
    db.commit()
    return None

from typing import List
from fastapi import HTTPException, status, Depends
from fastapi import APIRouter
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from .. import models, schemas
from .. import OAuth2
from .products import get_ratings_summary_by_product_ids


def get_wishlist_item_with_images(
    wishlist_item: models.DBWishlistItem,
    ratings_map: dict | None = None,
    *,
    catalog_only: bool = False,
) -> dict:
    """Helper function to convert DBWishlistItem to dict with product images."""
    original_price = float(wishlist_item.product.price)
    discounted_price = float(wishlist_item.product.final_price)
    has_discount = discounted_price < original_price
    rating_summary = (ratings_map or {}).get(wishlist_item.product.id, {})
    image_paths = [img.image_path for img in wishlist_item.product.images]
    if catalog_only:
        image_paths = image_paths[:1]
    return {
        "id": wishlist_item.id,
        "product_id": wishlist_item.product_id,
        "product": {
            "id": wishlist_item.product.id,
            "name": wishlist_item.product.name,
            "name_ar": wishlist_item.product.name_ar,
            "name_fr": wishlist_item.product.name_fr,
            "price": discounted_price,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_enabled": bool(wishlist_item.product.discount_enabled),
            "has_discount": has_discount,
            "category_name": wishlist_item.product.category_name,
            "category_name_ar": wishlist_item.product.category.name_ar if wishlist_item.product.category else None,
            "category_name_fr": wishlist_item.product.category.name_fr if wishlist_item.product.category else None,
            "description": "" if catalog_only else wishlist_item.product.description,
            "description_ar": None if catalog_only else wishlist_item.product.description_ar,
            "description_fr": None if catalog_only else wishlist_item.product.description_fr,
            "images": image_paths,
            "average_rating": float(rating_summary.get("average_rating", 0.0)),
            "total_ratings": int(rating_summary.get("total_ratings", 0)),
        }
    }


def _wishlist_with_items_query(db: Session):
    return db.query(models.DBWishlist).options(
        joinedload(models.DBWishlist.items)
        .joinedload(models.DBWishlistItem.product)
        .joinedload(models.DBProduct.images),
        joinedload(models.DBWishlist.items)
        .joinedload(models.DBWishlistItem.product)
        .joinedload(models.DBProduct.category),
    )


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
    
    ratings_map = get_ratings_summary_by_product_ids(db, [product.id])
    return get_wishlist_item_with_images(wishlist_item, ratings_map)


@router.get("/showmewishlist", response_model=schemas.WishlistResponse)
def show_me_wishlist(db: Session = Depends(get_db), 
                     current_user: schemas.User = Depends(OAuth2.get_current_user)):

    wishlist = (
        _wishlist_with_items_query(db)
        .filter(models.DBWishlist.user_id == current_user.id)
        .first()
    )
    if not wishlist:
        return {
            "items": []
        }
    
    if not wishlist.items:
        return {
            "items": []
        }

    product_ids = [item.product_id for item in wishlist.items]
    ratings_map = get_ratings_summary_by_product_ids(db, product_ids)
    wishlist_items = [
        get_wishlist_item_with_images(item, ratings_map, catalog_only=True)
        for item in wishlist.items
    ]

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

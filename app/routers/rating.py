from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError
from typing import Optional
from app import OAuth2, models, schemas
from app.database import get_db
from app.routers.admin import require_admin
from datetime import datetime

router = APIRouter(
    tags=['Ratings']
)


@router.get("/products/{product_id}/rating", response_model=schemas.ProductRatingSummary)
def get_product_rating(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[schemas.TokenData] = Depends(OAuth2.get_current_user_optional)
):
    """
    Get rating summary for a product. Public endpoint - no authentication required.
    Returns average rating, total count, and current user's rating if authenticated.
    """
    # Verify product exists
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Calculate average rating and total count
    rating_stats = db.query(
        func.avg(models.DBProductRating.rating).label('average'),
        func.count(models.DBProductRating.id).label('total')
    ).filter(
        models.DBProductRating.product_id == product_id
    ).first()
    
    average_rating = float(rating_stats.average) if rating_stats.average else 0.0
    total_ratings = rating_stats.total if rating_stats.total else 0
    
    # Get current user's rating if authenticated
    user_rating = None
    if current_user:
        user_rating_obj = db.query(models.DBProductRating).filter(
            models.DBProductRating.product_id == product_id,
            models.DBProductRating.user_id == current_user.id
        ).first()
        if user_rating_obj:
            user_rating = user_rating_obj.rating
    
    return schemas.ProductRatingSummary(
        average_rating=round(average_rating, 2),
        total_ratings=total_ratings,
        user_rating=user_rating
    )


@router.get("/products/{product_id}/ratings", response_model=list[schemas.RatingDisplay])
def get_product_ratings(
    product_id: int,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get all ratings for a product. Public endpoint.
    """
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    ratings = db.query(models.DBProductRating)\
        .filter(models.DBProductRating.product_id == product_id)\
        .order_by(desc(models.DBProductRating.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()

    return ratings


@router.post("/products/{product_id}/rating", response_model=schemas.RatingDisplay, status_code=status.HTTP_201_CREATED)
def create_or_update_rating(
    product_id: int,
    rating: schemas.RatingCreate,
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user)
):
    """
    Create or update a rating for a product. Requires authentication.
    If user already rated this product, the rating will be updated.
    """
    # Verify product exists
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate rating value
    if rating.rating < 1 or rating.rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )
    
    # Check if user already rated this product
    existing_rating = db.query(models.DBProductRating).filter(
        models.DBProductRating.product_id == product_id,
        models.DBProductRating.user_id == current_user.id
    ).first()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating.rating
        existing_rating.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_rating)
        return existing_rating
    else:
        # Create new rating
        new_rating = models.DBProductRating(
            rating=rating.rating,
            product_id=product_id,
            user_id=current_user.id
        )
        
        try:
            db.add(new_rating)
            db.commit()
            db.refresh(new_rating)
            return new_rating
        except IntegrityError:
            db.rollback()
            # Handle race condition where rating was created between check and insert
            existing_rating = db.query(models.DBProductRating).filter(
                models.DBProductRating.product_id == product_id,
                models.DBProductRating.user_id == current_user.id
            ).first()
            if existing_rating:
                existing_rating.rating = rating.rating
                existing_rating.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(existing_rating)
                return existing_rating
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create rating"
            )


@router.delete("/products/{product_id}/rating", status_code=status.HTTP_204_NO_CONTENT)
def delete_rating(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user)
):
    """
    Delete a user's rating for a product. Users can only delete their own ratings.
    """
    rating = db.query(models.DBProductRating).filter(
        models.DBProductRating.product_id == product_id,
        models.DBProductRating.user_id == current_user.id
    ).first()
    
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found"
        )
    
    db.delete(rating)
    db.commit()
    
    return None


@router.get("/ratings/all", response_model=list[schemas.RatingDisplay])
def get_all_ratings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Get all ratings. Admin only endpoint.
    """
    ratings = db.query(models.DBProductRating)\
        .order_by(desc(models.DBProductRating.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return ratings

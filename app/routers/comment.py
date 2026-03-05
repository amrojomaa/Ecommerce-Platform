from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from typing import List, Optional
from app import OAuth2, models, schemas
from app.database import get_db
from app.routers.admin import require_admin
from app.utils.sentiment_analysis import analyze_sentiment

router = APIRouter(
    tags=['Comments']
)


@router.get("/products/{product_id}/comments", response_model=List[schemas.CommentDisplay])
def get_product_comments(
    product_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get comments for a product. Public endpoint - no authentication required.
    Returns comments ordered by newest first.
    """
    # Verify product exists
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Get comments ordered by newest first, with user relationship eagerly loaded
    comments = db.query(models.DBComment)\
        .options(joinedload(models.DBComment.user))\
        .filter(models.DBComment.product_id == product_id)\
        .order_by(desc(models.DBComment.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return comments


@router.post("/products/{product_id}/comments", response_model=schemas.CommentDisplay, status_code=status.HTTP_201_CREATED)
def create_comment(
    product_id: int,
    comment: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """
    Create a new comment on a product. Requires authentication.
    """
    # Verify product exists
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Use product_id from URL path (ignore product_id in body if provided)
    # Analyze sentiment of the comment
    sentiment = analyze_sentiment(comment.content)
    
    # Create comment with sentiment
    new_comment = models.DBComment(
        content=comment.content,
        sentiment=sentiment,
        product_id=product_id,
        user_id=current_user.id
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return new_comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """
    Delete a comment. Users can delete their own comments, admins can delete any comment.
    """
    comment = db.query(models.DBComment).filter(models.DBComment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Get current user from database
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    # Check if user is the comment owner or an admin
    if comment.user_id != current_user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this comment"
        )
    
    db.delete(comment)
    db.commit()
    
    return None


@router.get("/comments/all", response_model=List[schemas.CommentDisplay])
def get_all_comments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Get all comments. Admin only endpoint.
    """
    comments = db.query(models.DBComment)\
        .options(joinedload(models.DBComment.user))\
        .order_by(desc(models.DBComment.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return comments


@router.get("/products/{product_id}/sentiment-analytics", response_model=schemas.ProductSentimentAnalytics)
def get_product_sentiment_analytics(
    product_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Get sentiment analytics for a product. Admin only endpoint.
    Returns counts of positive, neutral, and negative reviews.
    """
    # Verify product exists
    product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Get total count of all comments (including NULL sentiments)
    total_count = db.query(func.count(models.DBComment.id))\
        .filter(models.DBComment.product_id == product_id)\
        .scalar() or 0
    
    # Get sentiment counts (excluding NULL)
    sentiment_counts = db.query(
        models.DBComment.sentiment,
        func.count(models.DBComment.id).label('count')
    ).filter(
        models.DBComment.product_id == product_id,
        models.DBComment.sentiment.isnot(None)
    ).group_by(
        models.DBComment.sentiment
    ).all()
    
    # Initialize counts
    positive_count = 0
    neutral_count = 0
    negative_count = 0
    
    # Process sentiment counts
    for sentiment, count in sentiment_counts:
        if sentiment == 'positive':
            positive_count = count
        elif sentiment == 'neutral':
            neutral_count = count
        elif sentiment == 'negative':
            negative_count = count
    
    return schemas.ProductSentimentAnalytics(
        product_id=product_id,
        total_reviews=total_count,
        positive_count=positive_count,
        neutral_count=neutral_count,
        negative_count=negative_count
    )


@router.post("/comments/backfill-sentiment", status_code=status.HTTP_200_OK)
def backfill_sentiment_for_comments(
    product_id: Optional[int] = Query(None, description="Optional product ID to backfill sentiment for specific product"),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Backfill sentiment analysis for all comments that don't have sentiment values.
    If product_id is provided, only backfill comments for that product.
    Admin only endpoint.
    """
    # Build query for comments without sentiment
    query = db.query(models.DBComment)\
        .filter(models.DBComment.sentiment.is_(None))
    
    # Filter by product if provided
    if product_id:
        query = query.filter(models.DBComment.product_id == product_id)
        # Verify product exists
        product = db.query(models.DBProduct).filter(models.DBProduct.id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
    
    comments_without_sentiment = query.all()
    
    if not comments_without_sentiment:
        message = "All comments already have sentiment values"
        if product_id:
            message = f"All comments for this product already have sentiment values"
        return {
            "message": message,
            "updated": 0,
            "total": 0
        }
    
    updated = 0
    errors = 0
    
    for comment in comments_without_sentiment:
        try:
            # Analyze sentiment
            sentiment = analyze_sentiment(comment.content)
            
            # Update comment
            comment.sentiment = sentiment
            updated += 1
        except Exception as e:
            errors += 1
            continue
    
    # Commit all updates
    try:
        db.commit()
        message = f"Successfully updated {updated} comments with sentiment analysis"
        if product_id:
            message = f"Successfully updated {updated} comments for this product with sentiment analysis"
        return {
            "message": message,
            "updated": updated,
            "total": len(comments_without_sentiment),
            "errors": errors
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error committing sentiment updates: {str(e)}"
        )

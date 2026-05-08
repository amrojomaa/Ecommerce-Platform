from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app import OAuth2, models, schemas
from app.database import get_db
from app.routers.admin import require_admin_or_support_manager

router = APIRouter(tags=["Customer Feedback"])


@router.get("/feedback/me", response_model=schemas.CustomerFeedbackDisplay)
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
):
    """Return the current authenticated user's feedback if it exists."""
    feedback = (
        db.query(models.DBCustomerFeedback)
        .options(joinedload(models.DBCustomerFeedback.user))
        .filter(models.DBCustomerFeedback.user_id == current_user.id)
        .order_by(desc(models.DBCustomerFeedback.created_at))
        .first()
    )
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )
    return feedback


@router.post("/feedback/me", response_model=schemas.CustomerFeedbackDisplay)
def create_my_feedback(
    payload: schemas.CustomerFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
):
    """Create a new feedback row for every submission from the authenticated user."""
    feedback = models.DBCustomerFeedback(
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)

    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/feedback/all", response_model=List[schemas.CustomerFeedbackDisplay])
def get_all_feedback(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    rating: Optional[int] = Query(None, ge=1, le=5),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_or_support_manager),
):
    """List all customer feedback entries for admin/support panel."""
    query = db.query(models.DBCustomerFeedback).options(
        joinedload(models.DBCustomerFeedback.user)
    )

    if rating is not None:
        query = query.filter(models.DBCustomerFeedback.rating == rating)

    feedback_rows = (
        query.order_by(desc(models.DBCustomerFeedback.updated_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return feedback_rows

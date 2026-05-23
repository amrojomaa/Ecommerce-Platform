from fastapi import File, HTTPException, UploadFile, status, Depends, Query
from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .admin import require_admin, require_admin_or_support_manager
from ..database import get_db
from .. import models, utils, schemas
from .. import OAuth2
from typing import List, Optional
from app.utils.image_storage import delete_local_image, is_local_image_path, save_uploaded_image


router = APIRouter(
    # prefix="/users",
    tags=['Users']
)


# @router.post("/users/create", status_code=status.HTTP_201_CREATED, response_model = schemas.User)
# def create_user(user :schemas.UserBase, db: Session = Depends (get_db), ):#admin_user = Depends(require_admin)):
#     user.password = utils.hash(user.password)
#     new_user = models.DBUser(**user.dict())
#     db.add(new_user)
#     db.commit()
#     db.refresh(new_user)
#     return new_user
    

@router.get("/users/all", response_model=List[schemas.User])
def get_all_user(
    role: Optional[str] = Query(
        None,
        description="Filter by role: admin, support_manager, operations_manager, warehouse_manager, support_agent, driver, cashier, or customer",
    ),
    db: Session = Depends (get_db), 
    current_user = Depends(require_admin_or_support_manager)
):
    query = db.query(models.DBUser).filter(models.DBUser.role != "walkin")
    
    # Filter by role if provided
    if role:
        if role not in schemas.ALL_USER_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid role. Must be one of: admin, support_manager, support_agent, "
                    "operations_manager, warehouse_manager, seller, warehouse_staff, employee, "
                    "customer, driver, cashier, walkin"
                ),
            )
        query = query.filter(models.DBUser.role == role)
    
    users = query.all()
    return users
    

# @router.get("/users/current", response_model=schemas.User)
# def get_current_user(db: Session = Depends (get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
#     user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
#     if user == None:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
#     return user

@router.get("/users/me/information", response_model=schemas.User)
def get_me_information(db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user


@router.get("/users/{id}", response_model=schemas.User)
def get_users_by_id(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    user = db.query(models.DBUser).filter(models.DBUser.id == id).first()
    if user == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user


@router.put("/users/me", response_model=schemas.User)
def update_me(user: schemas.UserUpdate, db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    update_data = user.dict(exclude_unset=True)
    # Self-service profile updates must never mutate authorization role.
    update_data.pop("role", None)
    # Only hash password if it's provided and not empty
    if update_data.get('password'):
        update_data['password'] = utils.hash(update_data['password'])
    else:
        # Remove password from update if not provided
        update_data.pop('password', None)
    
    updateuser = db.query(models.DBUser).filter(models.DBUser.id == current_user.id)
    updateuser.update(update_data, synchronize_session=False)
    db.commit()
    return updateuser.first()


@router.put("/users/{id}", response_model=schemas.User)
def update_user(user: schemas.UserBase, id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    user.password = utils.hash(user.password)
    updateuser = db.query(models.DBUser).filter(models.DBUser.id == id)
    update = updateuser.first()
    if update == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    updateuser.update(user.dict(), synchronize_session=False)
    db.commit()
    return updateuser.first()


@router.patch("/users/{id}/role", response_model=schemas.User)
def update_user_role(
    role_update: schemas.UserRoleUpdate,
    id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Update user role - Admin only"""
    user = db.query(models.DBUser).filter(models.DBUser.id == id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Prevent admin from changing their own role
    if current_user.id == id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role"
        )
    
    # Update the role
    user.role = role_update.role
    # Note: We don't increment token_version here to keep the user's session active
    # The frontend will automatically detect the role change through periodic user info checks
    db.commit()
    db.refresh(user)
    
    return user


@router.patch("/users/{id}/block", response_model=schemas.User)
def update_user_blocked(
    block_update: schemas.UserBlockUpdate,
    id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin),
    current_user=Depends(OAuth2.get_current_user),
):
    """Suspend or restore a user account. Admin cannot block their own account."""
    user = db.query(models.DBUser).filter(models.DBUser.id == id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.id == id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot block or unblock your own account",
        )

    user.is_blocked = block_update.is_blocked
    if block_update.is_blocked:
        user.token_version = (user.token_version or 0) + 1

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_user(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin), current_user: int = Depends(OAuth2.get_current_user)):

    user = db.query(models.DBUser).filter(models.DBUser.id == id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if (current_user.id == id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're admin dont delete yoreself")
    
    try:
        # 1. Nullify references where this user acted as an employee/manager/driver
        db.query(models.DBOrder).filter(models.DBOrder.driver_id == id).update({models.DBOrder.driver_id: None}, synchronize_session=False)
        db.query(models.DBOrder).filter(models.DBOrder.cashier_id == id).update({models.DBOrder.cashier_id: None}, synchronize_session=False)
        db.query(models.DBTicket).filter(models.DBTicket.employee_id == id).update({models.DBTicket.employee_id: None}, synchronize_session=False)
        db.query(models.DBTicket).filter(models.DBTicket.assigned_by == id).update({models.DBTicket.assigned_by: None}, synchronize_session=False)
        db.query(models.DBTicket).filter(models.DBTicket.delete_requested_by == id).update({models.DBTicket.delete_requested_by: None}, synchronize_session=False)
        db.query(models.DBTicket).filter(models.DBTicket.last_updated_by == id).update({models.DBTicket.last_updated_by: None}, synchronize_session=False)
        db.query(models.DBDeliveryJob).filter(models.DBDeliveryJob.driver_id == id).update({models.DBDeliveryJob.driver_id: None}, synchronize_session=False)
        db.query(models.DBInstallmentRequest).filter(models.DBInstallmentRequest.reviewed_by == id).update({models.DBInstallmentRequest.reviewed_by: None}, synchronize_session=False)
        db.query(models.DBInstallmentPayment).filter(models.DBInstallmentPayment.marked_by == id).update({models.DBInstallmentPayment.marked_by: None}, synchronize_session=False)

        # 2. Hard delete records owned by the user (Cascading manually to avoid FK errors)
        db.query(models.DBUserInteraction).filter(models.DBUserInteraction.user_id == id).delete(synchronize_session=False)
        db.query(models.DBRecommendationBatchCache).filter(models.DBRecommendationBatchCache.user_id == id).delete(synchronize_session=False)
        db.query(models.DBTicketResponse).filter(models.DBTicketResponse.user_id == id).delete(synchronize_session=False)
        db.query(models.DBComment).filter(models.DBComment.user_id == id).delete(synchronize_session=False)
        db.query(models.DBProductRating).filter(models.DBProductRating.user_id == id).delete(synchronize_session=False)
        db.query(models.DBCustomerFeedback).filter(models.DBCustomerFeedback.user_id == id).delete(synchronize_session=False)
        db.query(models.DBInstallmentRequest).filter(models.DBInstallmentRequest.user_id == id).delete(synchronize_session=False)

        # Orders and associated items
        order_ids = [o.id for o in db.query(models.DBOrder.id).filter(models.DBOrder.user_id == id).all()]
        if order_ids:
            db.query(models.DBOrderItem).filter(models.DBOrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
            db.query(models.DBDeliveryJob).filter(models.DBDeliveryJob.order_id.in_(order_ids)).delete(synchronize_session=False)
            db.query(models.DBInstallmentRequest).filter(models.DBInstallmentRequest.order_id.in_(order_ids)).delete(synchronize_session=False)
            db.query(models.DBOrder).filter(models.DBOrder.id.in_(order_ids)).delete(synchronize_session=False)

        # Carts and associated items
        cart_ids = [c.id for c in db.query(models.DBCart.id).filter(models.DBCart.user_id == id).all()]
        if cart_ids:
            db.query(models.DBCartItem).filter(models.DBCartItem.cart_id.in_(cart_ids)).delete(synchronize_session=False)
            db.query(models.DBCart).filter(models.DBCart.id.in_(cart_ids)).delete(synchronize_session=False)

        # Wishlists and associated items
        wishlist_ids = [w.id for w in db.query(models.DBWishlist.id).filter(models.DBWishlist.user_id == id).all()]
        if wishlist_ids:
            db.query(models.DBWishlistItem).filter(models.DBWishlistItem.wishlist_id.in_(wishlist_ids)).delete(synchronize_session=False)
            db.query(models.DBWishlist).filter(models.DBWishlist.id.in_(wishlist_ids)).delete(synchronize_session=False)

        # Tickets and associated items
        ticket_ids = [t.id for t in db.query(models.DBTicket.id).filter(models.DBTicket.customer_id == id).all()]
        if ticket_ids:
            db.query(models.DBTicketResponse).filter(models.DBTicketResponse.ticket_id.in_(ticket_ids)).delete(synchronize_session=False)
            db.query(models.DBTicket).filter(models.DBTicket.id.in_(ticket_ids)).delete(synchronize_session=False)

        # 3. Delete the user
        db.delete(user)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Force deletion failed due to an unhandled database constraint: {str(e.__cause__)}"
        )



@router.post("/image")
def upload_image(image: UploadFile = File(...), current_user: int = Depends(OAuth2.get_current_user)):
    path = save_uploaded_image(image, "misc")
    return {"filename": path}

@router.post("/users/me/profile-image")
def upload_profile_image(image: UploadFile = File(...), db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    previous_path = user.profile_image if is_local_image_path(user.profile_image) else None
    path = save_uploaded_image(image, "profile")

    user.profile_image = path
    db.commit()
    db.refresh(user)

    if previous_path and previous_path != path:
        shared_profile_image = (
            db.query(models.DBUser.id)
            .filter(
                models.DBUser.profile_image == previous_path,
                models.DBUser.id != user.id,
            )
            .first()
        )
        if not shared_profile_image:
            delete_local_image(previous_path)

    return {"profile_image": user.profile_image}


@router.delete("/users/me/profile-image", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile_image(db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    """
    Delete user's profile image and set it to None (default).
    """
    # Get current user
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if is_local_image_path(user.profile_image):
        shared_profile_image = (
            db.query(models.DBUser.id)
            .filter(
                models.DBUser.profile_image == user.profile_image,
                models.DBUser.id != user.id,
            )
            .first()
        )
        if not shared_profile_image:
            delete_local_image(user.profile_image)
    
    # Set profile_image to None
    user.profile_image = None
    db.commit()
    
    return None

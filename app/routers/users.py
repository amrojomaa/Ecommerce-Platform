import random
import shutil
import string
from fastapi import File, HTTPException, UploadFile, status, Depends, Query
from fastapi import APIRouter
from sqlalchemy.orm import Session
from app.routers.admin import require_admin
from ..database import get_db
from app import models, utils, schemas
from app import OAuth2
from typing import List, Optional


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
    role: Optional[str] = Query(None, description="Filter by role: admin, employee, or customer"),
    db: Session = Depends (get_db), 
    admin_user = Depends(require_admin)
):
    query = db.query(models.DBUser)
    
    # Filter by role if provided
    if role:
        if role not in ["admin", "employee", "customer", "driver", "cashier"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be one of: admin, employee, customer, driver, cashier"
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
def update_user(user: schemas.UserBase, id :int, db: Session = Depends (get_db), ):#admin_user = Depends(require_admin)):
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

    deleteuser = db.query(models.DBUser).filter(models.DBUser.id == id)
    if deleteuser.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if (current_user.id == id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You're admin dont delete yoreself")
    
    deleteuser.delete(synchronize_session=False)
    db.commit()



@router.post("/image")
def upload_image(image: UploadFile = File(...), current_user: int = Depends(OAuth2.get_current_user)):
    letter = string.ascii_letters
    rand_str = ''.join(random.choice(letter) for i in range(6))
    new = f"_{rand_str}."
    filename = new.join(image.filename.rsplit(".", 1))
    path = f"images/{filename}"

    with open(path, "w+b") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"filename": path}

@router.post("/users/me/profile-image")
def upload_profile_image(image: UploadFile = File(...), db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    # Validate file type
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    letter = string.ascii_letters
    rand_str = ''.join(random.choice(letter) for i in range(6))
    new = f"_{rand_str}."
    filename = new.join(image.filename.rsplit(".", 1))
    path = f"images/profile/{filename}"

    # Create directory if it doesn't exist
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Save the image file
    with open(path, "w+b") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    # Validate and optimize image dimensions using PIL if available
    try:
        from PIL import Image
        with Image.open(path) as img:
            # Convert to RGB if necessary (handles RGBA, P mode, etc.)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            width, height = img.size
            # Minimum dimension: 300px to ensure quality even on high-DPI displays
            # Largest display size is 200px, so 300px provides 1.5x buffer for retina displays
            min_dimension = 300
            max_dimension = 2000
            
            if width < min_dimension or height < min_dimension:
                # Resize to minimum while maintaining aspect ratio
                if width < height:
                    new_width = min_dimension
                    new_height = int(height * (min_dimension / width))
                else:
                    new_height = min_dimension
                    new_width = int(width * (min_dimension / height))
                
                # Use high-quality LANCZOS resampling for upscaling
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                # Save with high quality to prevent compression artifacts
                resized_img.save(path, format='JPEG', optimize=True, quality=95)
            elif width > max_dimension or height > max_dimension:
                # Resize if too large to save storage
                if width > height:
                    new_width = max_dimension
                    new_height = int(height * (max_dimension / width))
                else:
                    new_height = max_dimension
                    new_width = int(width * (max_dimension / height))
                
                # Use LANCZOS for downscaling as well
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                resized_img.save(path, format='JPEG', optimize=True, quality=95)
            else:
                # Image is within acceptable range, but ensure it's saved as JPEG with good quality
                img.save(path, format='JPEG', optimize=True, quality=95)
    except ImportError:
        # PIL not available, skip image optimization
        pass
    except Exception as e:
        # If image processing fails, continue with original image
        print(f"Warning: Could not process image: {e}")

    # Update user's profile_image
    updateuser = db.query(models.DBUser).filter(models.DBUser.id == current_user.id)
    updateuser.update({"profile_image": path}, synchronize_session=False)
    db.commit()
    
    user = updateuser.first()
    return {"profile_image": user.profile_image}


@router.delete("/users/me/profile-image", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile_image(db: Session = Depends(get_db), current_user: int = Depends(OAuth2.get_current_user)):
    """
    Delete user's profile image and set it to None (default).
    """
    import os
    
    # Get current user
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # If user has a profile image that's a local file, optionally delete the file
    # (We'll just set it to None to keep it simple - the file can be cleaned up later if needed)
    if user.profile_image and not user.profile_image.startswith('http'):
        # Optional: Delete the physical file if it exists
        if os.path.exists(user.profile_image):
            try:
                os.remove(user.profile_image)
            except Exception as e:
                # Log error but don't fail - we'll still clear the database field
                print(f"Error deleting profile image file: {e}")
    
    # Set profile_image to None
    user.profile_image = None
    db.commit()
    
    return None
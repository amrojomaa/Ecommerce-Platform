import random
import shutil
import string
from fastapi import File, HTTPException, UploadFile, status, Depends
from fastapi import APIRouter
from sqlalchemy.orm import Session
from app.routers.admin import require_admin
from ..database import get_db
from app import models, utils, schemas
from app import OAuth2
from typing import List


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
def get_all_user(db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    users = db.query(models.DBUser).all() 
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
def update_me(user: schemas.UserBase, db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
    user.password = utils.hash(user.password)
    updateuser = db.query(models.DBUser).filter(models.DBUser.id == current_user.id)
    updateuser.update(user.dict(), synchronize_session=False)
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
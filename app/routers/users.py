from base64 import decode
from typing import List
from fastapi import HTTPException, status, Response, Depends, Security
from fastapi import APIRouter
from sqlalchemy.orm import Session
from app.routers.admin import require_admin
from ..database import get_db
from app import models, utils, schemas
from ..OAuth2 import oauth2_scheme
from app import OAuth2


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
    

@router.get("/users/current", response_model=schemas.User)
def get_currenr_users(db: Session = Depends (get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if user == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user

@router.get("/users/me/information", response_model=schemas.UserA)
def get_me_information(db: Session = Depends (get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    return user


@router.get("/users/{id}", response_model=schemas.User)
def get_users_by_id(id :int, db: Session = Depends (get_db), current_user: int = Depends(OAuth2.get_current_user)):
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
def delete_user(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    deleteuser = db.query(models.DBUser).filter(models.DBUser.id == id)
    if deleteuser == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    deleteuser.delete(synchronize_session=False)
    db.commit()


#     @router.get("/users/{id}", status_code=status.HTTP_404_NOT_FOUND)
# def creat(id: int, response: Response):
#     # print(type(id))
#     if id > 5:
#         response.status_code=status.HTTP_404_NOT_FOUND
#         return {"massage" : "hello fastapi" + f"{id}"}
#     else:
#         response.status_code=status.HTTP_200_OK
#         return {"massage" : "hello fastapi" + f"{id}"}


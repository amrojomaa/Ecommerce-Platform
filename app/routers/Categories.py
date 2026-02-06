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
    tags=['Categories']
)


@router.post("/Categories/create", status_code=status.HTTP_201_CREATED, response_model=schemas.CategoriesDisplay)
def create_Category(category: schemas.Categories ,db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    categories = db.query(models.DBCategory).filter(models.DBCategory.name == category.name).first()
    if categories:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    new_category = models.DBCategory(**category.dict())
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@router.get("/Categories/all", response_model=List[schemas.CategoriesDisplay])
def get_all_Categories(db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    categories = db.query(models.DBCategory).all() 
    return categories

# @router.get("/products/alladmin", response_model=List[schemas.ProductBase])
# def get_all_products(db: Session = Depends (get_db), admin_user = Depends(require_admin)):
#     products = db.query(models.DBProduct).all() 
#     return products


@router.get("/Categories/name", response_model=schemas.CategoriesDisplay)
def get_category_by_name(name: str, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    category = db.query(models.DBCategory).filter(models.DBCategory.name == name).first()
    if category == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    return category

# @router.get("/products/name/byuser", response_model=schemas.Product)
# def get_products_by_name(name: str, db: Session = Depends (get_db)):
#     product = db.query(models.DBProduct).filter(models.DBProduct.name == name).first()
#     if product == None:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
#     return product

@router.get("/Categories/{id}", response_model=schemas.CategoriesDisplay)
def get_category_by_id(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)): 
    category = db.query(models.DBCategory).filter(models.DBCategory.id == id).first()
    if category == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    return category




@router.put("/Categories/{id}", response_model=schemas.CategoriesDisplay)
def update_category(product: schemas.Categories, id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    updatecategory = db.query(models.DBCategory).filter(models.DBCategory.id == id)
    update = updatecategory.first()
    if update == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    
    updatecategory.update(product.dict(), synchronize_session=False)
    db.commit()
    return updatecategory.first()


@router.delete("/Categories/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_category(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    category = db.query(models.DBCategory).filter(models.DBCategory.id == id)
    deletecat = category.first()
    if  deletecat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    
    if deletecat.products:   
        raise HTTPException(status_code=400,detail="Cannot delete category with products")
    category.delete(synchronize_session=False)
    db.commit()

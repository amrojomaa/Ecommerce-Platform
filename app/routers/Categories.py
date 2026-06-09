import random
import shutil
import string
from fastapi import File, HTTPException, UploadFile, status, Depends
from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.routers.admin import require_admin, require_seller
from ..database import get_db
from .. import models, utils, schemas
from .. import OAuth2
from typing import List


router = APIRouter(
    # prefix="/users",
    tags=['Categories']
)


@router.post("/Categories/create", status_code=status.HTTP_201_CREATED, response_model=schemas.CategoriesDisplay)
def create_Category(category: schemas.Categories ,db: Session = Depends (get_db), seller_user = Depends(require_seller)):
    categories = db.query(models.DBCategory).filter(models.DBCategory.name == category.name).first()
    if categories:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    new_category = models.DBCategory(**category.dict())
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@router.get("/Categories/all", response_model=List[schemas.CategoriesDisplay])
def get_all_Categories(db: Session = Depends (get_db)):
    categories = db.query(models.DBCategory).all() 
    return categories

# @router.get("/products/alladmin", response_model=List[schemas.ProductBase])
# def get_all_products(db: Session = Depends (get_db), admin_user = Depends(require_admin)):
#     products = db.query(models.DBProduct).all() 
#     return products


@router.get("/Categories/name", response_model=schemas.CategoriesDisplay)
def get_category_by_name(name: str, db: Session = Depends (get_db), seller_user = Depends(require_seller)):
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
def get_category_by_id(id :int, db: Session = Depends (get_db), seller_user = Depends(require_seller)): 
    category = db.query(models.DBCategory).filter(models.DBCategory.id == id).first()
    if category == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    return category




@router.put("/Categories/{id}", response_model=schemas.CategoriesDisplay)
def update_category(
    product: schemas.Categories,
    id: int,
    db: Session = Depends(get_db),
    seller_user=Depends(require_seller),
):
    existing = db.query(models.DBCategory).filter(models.DBCategory.id == id).first()
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")

    payload = product.dict()
    new_name = (payload.get("name") or "").strip()
    if not new_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name must not be empty")

    old_name = existing.name
    payload["name"] = new_name
    name_changed = new_name != old_name

    if name_changed:
        name_taken = (
            db.query(models.DBCategory.id)
            .filter(models.DBCategory.name == new_name, models.DBCategory.id != id)
            .first()
        )
        if name_taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")

    try:
        if name_changed:
            db.execute(text("SET CONSTRAINTS products_category_name_fkey DEFERRED"))

        for field, value in payload.items():
            setattr(existing, field, value)

        if name_changed:
            db.query(models.DBProduct).filter(models.DBProduct.category_name == old_name).update(
                {"category_name": new_name},
                synchronize_session=False,
            )

        db.commit()
        db.refresh(existing)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update category because the new name conflicts with existing data",
        )

    return existing


@router.delete("/Categories/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_category(id :int, db: Session = Depends (get_db), seller_user = Depends(require_seller)):
    category = db.query(models.DBCategory).filter(models.DBCategory.id == id)
    deletecat = category.first()
    if  deletecat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the category not a found")
    
    if deletecat.products:   
        raise HTTPException(status_code=400,detail="Cannot delete category with products")
    category.delete(synchronize_session=False)
    db.commit()

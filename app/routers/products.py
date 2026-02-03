from typing import List
from fastapi import HTTPException, status, Response, Depends
from fastapi import APIRouter
from app import OAuth2, models
from sqlalchemy.orm import Session

from app.routers.admin import require_admin
from ..database import get_db
from app import schemas


router = APIRouter(
    # prefix="/products",
    tags=['Products']
)



@router.post("/products/create", status_code=status.HTTP_201_CREATED, response_model=schemas.Product)
def create_product(product: schemas.ProductBase ,db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    products = db.query(models.DBProduct).filter(models.DBProduct.name == product.name).first()
    if products:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="the product name are exist")
    new_product = models.DBProduct(**product.dict())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@router.get("/products/all", response_model=List[schemas.Product])
def get_all_products(db: Session = Depends (get_db)):
    products = db.query(models.DBProduct).all() 
    return products


@router.get("/products/{id}", response_model=schemas.Product)
def get_products_by_id(id :int, db: Session = Depends (get_db)):
    product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return product


@router.put("/products/{id}", response_model=schemas.Product)
def update_product(product: schemas.ProductBase, id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    updateproduct = db.query(models.DBProduct).filter(models.DBProduct.id == id)
    update = updateproduct.first()
    if update == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    updateproduct.update(product.dict(), synchronize_session=False)
    db.commit()
    return updateproduct.first()


@router.delete("/products/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    deleteproduct = db.query(models.DBProduct).filter(models.DBProduct.id == id)
    if deleteproduct == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    deleteproduct.delete(synchronize_session=False)
    db.commit()



# @router.post("/products/{id}", status_code=status.HTTP_404_NOT_FOUND)
# def get_product_by_id(product: schemas.ProductBase, id: int, response: Response):
#     if id > 5:
#         response.status_code=status.HTTP_404_NOT_FOUND
#         return {product : f"id : {id}"}
#     else:
#         response.status_code=status.HTTP_200_OK
#         return {product : f"id : {id}"}


# @router.post("/sa")
# def creats():
#     return "hello fastapi post"

# class Size(str, Enum):
#     small = "small"
#     big = "big"

# @app.get("/items")
# def get_items(size, sSize):
#     return {"size": size, "Size": sSize}



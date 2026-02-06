from fastapi import HTTPException, status, Response, Depends
from fastapi import APIRouter
from app import OAuth2, models, schemas
from sqlalchemy.orm import Session
from app.routers.admin import require_admin
from ..database import get_db
from typing import List


router = APIRouter(
    # prefix="/products",
    tags=['Products']
)



@router.post("/products/create", status_code=status.HTTP_201_CREATED, response_model=schemas.ProductBase)
def create_product(product: schemas.ProductBase ,db: Session = Depends (get_db), admin_user = Depends(require_admin)):

    category_name = product.category_name
    category = db.query(models.DBCategory).filter(models.DBCategory.name == category_name).first()

    if not category:
        raise HTTPException(status_code=404,detail="Category not found")
    
    products = db.query(models.DBProduct).filter(models.DBProduct.name == product.name).first()
    if products:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product name already exists")
    
    new_product = models.DBProduct(**product.dict())

    # new_product = models.DBProduct(
    # name=product.name,
    # description=product.description,
    # price=product.price,
    # quantity=product.quantity,
    # category_name=category.name)
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@router.get("/products/all", response_model=List[schemas.Product])
def get_all_products(db: Session = Depends (get_db)):
    products = db.query(models.DBProduct).all() 
    return products

@router.get("/products/alladmin", response_model=List[schemas.ProductBase])
def get_all_products(db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    products = db.query(models.DBProduct).all() 
    return products


@router.get("/products/name/byadmin", response_model=schemas.ProductBase)
def get_products_by_name(name: str, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    product = db.query(models.DBProduct).filter(models.DBProduct.name == name).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    return product

@router.get("/products/name/byuser", response_model=schemas.Product)
def get_products_by_name(name: str, db: Session = Depends (get_db)):
    product = db.query(models.DBProduct).filter(models.DBProduct.name == name).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    return product

@router.get("/products/{id}", response_model=schemas.ProductBase)
def get_products_by_id(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)): 
    product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    return product




@router.put("/products/{id}", response_model=schemas.ProductBase)
def update_product(product: schemas.ProductBase, id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    
    updateproduct = db.query(models.DBProduct).filter(models.DBProduct.id == id)
    update = updateproduct.first()
    if update == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    
    prod = db.query(models.DBProduct).filter(models.DBProduct.name == product.name).first()
    if prod :
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Product name already exists")
    
    category_name = product.category_name
    category = db.query(models.DBCategory).filter(models.DBCategory.name == category_name).first()

    if not category:
        raise HTTPException(status_code=404,detail="Category not found")
    
    updateproduct.update(product.dict(), synchronize_session=False)

    # updateproduct.update({
    #     update.name: product.name,
    #     update.description: product.description,
    #     update.price: product.price,
    #     update.quantity: product.quantity,
    #     update.category_name: product.category_name
    # }, synchronize_session=False)
    db.commit()
    return updateproduct.first()


@router.delete("/products/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin)):
    deleteproduct = db.query(models.DBProduct).filter(models.DBProduct.id == id)
    if deleteproduct.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    
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



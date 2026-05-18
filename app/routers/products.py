from fastapi import HTTPException, status, Response, Depends
from fastapi import APIRouter
from .. import OAuth2, models, schemas
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from .admin import require_admin_or_warehouse_manager
from ..database import get_db
from typing import List, Dict


def validate_discount(price: float, discount_enabled: bool, discount_type: str | None, discount_value: float | None):
    if not discount_enabled:
        return False, None, 0.0

    if discount_type not in ["percentage", "fixed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discount_type must be either 'percentage' or 'fixed' when discount is enabled"
        )

    if discount_value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discount_value is required when discount is enabled"
        )

    try:
        value = float(discount_value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discount_value must be a valid number"
        )

    if value <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discount_value must be greater than zero when discount is enabled"
        )

    if discount_type == "percentage":
        if value > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Percentage discount cannot be more than 100"
            )
        discount_amount = price * (value / 100)
    else:
        if value > price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fixed discount cannot exceed the original price"
            )
        discount_amount = value

    final_price = price - discount_amount
    if final_price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Final price cannot be less than zero")

    return True, discount_type, round(value, 2)


router = APIRouter(
    # prefix="/products",
    tags=['Products']
)


def get_ratings_summary_by_product_ids(db: Session, product_ids: List[int]) -> Dict[int, dict]:
    if not product_ids:
        return {}

    rows = (
        db.query(
            models.DBProductRating.product_id.label("product_id"),
            func.avg(models.DBProductRating.rating).label("average_rating"),
            func.count(models.DBProductRating.id).label("total_ratings"),
        )
        .filter(models.DBProductRating.product_id.in_(product_ids))
        .group_by(models.DBProductRating.product_id)
        .all()
    )

    ratings_map: Dict[int, dict] = {}
    for row in rows:
        ratings_map[row.product_id] = {
            "average_rating": round(float(row.average_rating or 0), 2),
            "total_ratings": int(row.total_ratings or 0),
        }
    return ratings_map


def get_product_with_images(product: models.DBProduct, ratings_map: Dict[int, dict] | None = None) -> dict:
    """Helper function to convert DBProduct to dict with images"""
    rating_summary = (ratings_map or {}).get(product.id, {})
    product_dict = {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": float(product.price),
        "discount_enabled": bool(product.discount_enabled),
        "discount_type": product.discount_type,
        "discount_value": float(product.discount_value or 0),
        "discounted_price": float(product.discounted_price),
        "quantity": product.quantity,
        "category_name": product.category_name,
        "images": [img.image_path for img in product.images],
        "average_rating": float(rating_summary.get("average_rating", 0.0)),
        "total_ratings": int(rating_summary.get("total_ratings", 0)),
    }
    return product_dict


@router.get("/products/filter", response_model=list[schemas.Product])
def filter_products(prod: schemas.FilterProducts = Depends(), db: Session = Depends(get_db)):
    query = db.query(models.DBProduct)
    if prod.name:
        query = query.filter(models.DBProduct.name.ilike(f"%{prod.name}%"))
    if prod.category:
        query = query.filter(models.DBProduct.category_name.ilike(f"%{prod.category}%"))
    if prod.min_price:
        try:
            min_price = float(prod.min_price)
            query = query.filter(models.DBProduct.price >= min_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid min_price
    if prod.max_price:
        try:
            max_price = float(prod.max_price)
            query = query.filter(models.DBProduct.price <= max_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid max_price
    products = query.all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")
    ratings_map = get_ratings_summary_by_product_ids(db, [p.id for p in products])
    return [schemas.Product(**get_product_with_images(p, ratings_map)) for p in products]

@router.get("/products/filter/user", response_model=list[schemas.Product])
def filter_products_user(prod: schemas.FilterProducts = Depends(), db: Session = Depends(get_db), current_user: schemas.User = Depends(OAuth2.get_current_user)):
    query = db.query(models.DBProduct)
    if prod.name:
        query = query.filter(models.DBProduct.name.ilike(f"%{prod.name}%"))
    if prod.category:
        query = query.filter(models.DBProduct.category_name.ilike(f"%{prod.category}%"))
    if prod.min_price:
        try:
            min_price = float(prod.min_price)
            query = query.filter(models.DBProduct.price >= min_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid min_price
    if prod.max_price:
        try:
            max_price = float(prod.max_price)
            query = query.filter(models.DBProduct.price <= max_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid max_price
    products = query.all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")
    ratings_map = get_ratings_summary_by_product_ids(db, [p.id for p in products])
    return [schemas.Product(**get_product_with_images(p, ratings_map)) for p in products]

@router.get("/products/filter/admin", response_model=list[schemas.ProductBase])
def filter_products_admin(prod: schemas.FilterProducts = Depends(), db: Session = Depends(get_db), admin_user = Depends(require_admin_or_warehouse_manager)):
    query = db.query(models.DBProduct)
    if prod.name:
        query = query.filter(models.DBProduct.name.ilike(f"%{prod.name}%"))
    if prod.category:
        query = query.filter(models.DBProduct.category_name.ilike(f"%{prod.category}%"))
    if prod.min_price:
        try:
            min_price = float(prod.min_price)
            query = query.filter(models.DBProduct.price >= min_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid min_price
    if prod.max_price:
        try:
            max_price = float(prod.max_price)
            query = query.filter(models.DBProduct.price <= max_price)
        except (ValueError, TypeError):
            pass  # Ignore invalid max_price
    products = query.all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")
    return [schemas.ProductBase(**get_product_with_images(p)) for p in products]

@router.post("/products/create", status_code=status.HTTP_201_CREATED, response_model=schemas.ProductBase)
def create_product(product: schemas.ProductBase ,db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)):

    category_name = product.category_name
    category = db.query(models.DBCategory).filter(models.DBCategory.name == category_name).first()

    if not category:
        raise HTTPException(status_code=404,detail="Category not found")
    
    products = db.query(models.DBProduct).filter(models.DBProduct.name == product.name).first()
    if products:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product name already exists")
    
    # Validate images: must have 1-3 images
    images = product.images or []
    if len(images) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one image is required")
    if len(images) > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 3 images allowed")
    
    # Create product without images/derived fields
    product_dict = product.dict()
    product_dict.pop('images', None)
    product_dict.pop('discounted_price', None)
    discount_enabled, discount_type, discount_value = validate_discount(
        float(product_dict.get("price", 0)),
        bool(product_dict.get("discount_enabled", False)),
        product_dict.get("discount_type"),
        product_dict.get("discount_value"),
    )
    product_dict["discount_enabled"] = discount_enabled
    product_dict["discount_type"] = discount_type
    product_dict["discount_value"] = discount_value
    new_product = models.DBProduct(**product_dict)
    
    db.add(new_product)
    db.flush()  # Flush to get the product ID
    
    # Create product images
    for image_path in images:
        product_image = models.DBProductImage(
            product_id=new_product.id,
            image_path=image_path
        )
        db.add(product_image)
    
    db.commit()
    db.refresh(new_product)
    
    # Return product with images
    return schemas.ProductBase(**get_product_with_images(new_product))


@router.get("/products/all", response_model=List[schemas.Product])
def get_all_products(db: Session = Depends (get_db)):
    products = db.query(models.DBProduct).all()
    ratings_map = get_ratings_summary_by_product_ids(db, [p.id for p in products])
    return [schemas.Product(**get_product_with_images(p, ratings_map)) for p in products]

@router.get("/products/alladmin", response_model=List[schemas.ProductBase])
def get_all_products(db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)):
    products = db.query(models.DBProduct).all() 
    return [schemas.ProductBase(**get_product_with_images(p)) for p in products]


@router.get("/products/name/byadmin", response_model=schemas.ProductBase)
def get_products_by_name(name: str, db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)):
    product = db.query(models.DBProduct).filter(models.DBProduct.name == name).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    return schemas.ProductBase(**get_product_with_images(product))

@router.get("/products/name/byuser", response_model=schemas.Product)
def get_products_by_name(name: str, db: Session = Depends (get_db)):
    product = db.query(models.DBProduct).filter(models.DBProduct.name == name).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    ratings_map = get_ratings_summary_by_product_ids(db, [product.id])
    return schemas.Product(**get_product_with_images(product, ratings_map))

@router.get("/products/{id}", response_model=schemas.ProductBase)
def get_products_by_id(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)): 
    product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
    if product == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
    return schemas.ProductBase(**get_product_with_images(product))




@router.put("/products/{id}", response_model=schemas.ProductBase)
def update_product(product: schemas.ProductBase, id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)):
    try:
        updateproduct = db.query(models.DBProduct).filter(models.DBProduct.id == id)
        update = updateproduct.first()
        if update == None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="the product not a found")
        
        prod = db.query(models.DBProduct).filter(models.DBProduct.name == product.name).first()
        if prod and prod.id != id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Product name already exists")
        
        category_name = product.category_name
        category = db.query(models.DBCategory).filter(models.DBCategory.name == category_name).first()

        if not category:
            raise HTTPException(status_code=404,detail="Category not found")
        
        # Validate images: must have 1-3 images
        images = product.images or []
        if len(images) < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one image is required")
        if len(images) > 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 3 images allowed")
        
        # Update product without images, id, and derived fields
        product_dict = product.dict()
        product_dict.pop('images', None)
        product_dict.pop('id', None)  # Remove id to prevent updating primary key
        product_dict.pop('discounted_price', None)
        discount_enabled, discount_type, discount_value = validate_discount(
            float(product_dict.get("price", 0)),
            bool(product_dict.get("discount_enabled", False)),
            product_dict.get("discount_type"),
            product_dict.get("discount_value"),
        )
        product_dict["discount_enabled"] = discount_enabled
        product_dict["discount_type"] = discount_type
        product_dict["discount_value"] = discount_value
        updateproduct.update(product_dict, synchronize_session=False)
        
        # Delete existing images
        db.query(models.DBProductImage).filter(models.DBProductImage.product_id == id).delete()
        
        # Add new images
        for image_path in images:
            product_image = models.DBProductImage(
                product_id=id,
                image_path=image_path
            )
            db.add(product_image)
        
        db.commit()
        db.refresh(update)
        
        # Query again to get the updated product with images
        updated_product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
        return schemas.ProductBase(**get_product_with_images(updated_product))
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating product: {str(e)}")


@router.patch("/products/{id}/discount", response_model=schemas.ProductBase)
def update_product_discount(
    id: int,
    payload: schemas.ProductDiscountUpdate,
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_or_warehouse_manager)
):
    product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    discount_enabled, discount_type, discount_value = validate_discount(
        float(product.price),
        payload.discount_enabled,
        payload.discount_type,
        payload.discount_value,
    )
    product.discount_enabled = discount_enabled
    product.discount_type = discount_type
    product.discount_value = discount_value

    db.commit()
    db.refresh(product)
    return schemas.ProductBase(**get_product_with_images(product))


@router.delete("/products/{id}",  status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id :int, db: Session = Depends (get_db), admin_user = Depends(require_admin_or_warehouse_manager)):
    try:
        product = db.query(models.DBProduct).filter(models.DBProduct.id == id).first()
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
        # Check if product has order items (for historical record keeping, prevent deletion)
        order_items = db.query(models.DBOrderItem).filter(models.DBOrderItem.product_id == id).first()
        if order_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Cannot delete product that has been ordered. Product is part of order history."
            )
        
        # Delete product images (cascade should handle this, but being explicit)
        db.query(models.DBProductImage).filter(models.DBProductImage.product_id == id).delete()
        
        # Delete cart items (cascade should handle this, but being explicit)
        db.query(models.DBCartItem).filter(models.DBCartItem.product_id == id).delete()
        
        # Delete the product
        db.query(models.DBProduct).filter(models.DBProduct.id == id).delete(synchronize_session=False)
        db.commit()
        
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        # Check if it's a foreign key constraint error
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'order_items' in error_msg.lower() or 'foreign key' in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete product that has been ordered. Product is part of order history."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete product due to database constraints: {error_msg}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error deleting product: {str(e)}"
        )




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



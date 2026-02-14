from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional

# from pydantic.types import conint

class FilterProducts(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    min_price: Optional[str] = None
    max_price: Optional[str] = None


class Categories(BaseModel):
    name: str
    description: str


class CategoriesDisplay(BaseModel):
    # id: int
    name: str
    description: str
    created_at: datetime

class ProductBase(BaseModel):
    name: str
    description: str
    price: float
    quantity: int
    category_name: str

    class Config:
        orm_mode = True
    
class Product(BaseModel):
    # id: int
    name: str
    description: str
    price: float
    quantity: int
    category_name: str

    class Config:
        orm_mode = True

class categoryname(BaseModel):
    name: str

    class Config:
        orm_mode = True


class Productname(BaseModel):
    name: str

    class Config:
        orm_mode = True

class UserBase(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    street: Optional[str] = None
    class Config:
        orm_mode = True

class User(BaseModel):
    # id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    street: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        orm_mode = True


class TokenData(BaseModel):
    id: Optional[int] = None


class AddCart(BaseModel):
    product_name: str
    quantity: int


class ShowCartOut(BaseModel):
    name: str
    price: float
    # quantity: int
    # total: float

    class Config:
        orm_mode = True

class ShowCart(BaseModel):
    product: ShowCartOut
    quantity: int
    total: float
    
class CartResponse(BaseModel):
    items: List[ShowCart]
    grand_total: float

    class Config:
        orm_mode = True

class Updateinputcart(BaseModel):
    quantity: int

class UpdateCartOut(BaseModel):
    name: str
    price: float

    class Config:
        orm_mode = True

class Updateoutputcart(BaseModel):
    product: UpdateCartOut
    quantity: int
    total: float


class Orderitemname(BaseModel):
    name: str

 
# class OrderItemResponse(BaseModel):
#     product: Orderitemname
#     quantity: int
#     price: float
#     total: float

#     class Config:
#         from_attributes = True
class OrderItemResponse(BaseModel):
    id: int
    product: Orderitemname
    quantity: int
    price: float
    total: float

    class Config:
        from_attributes = True



# class OrderResponse(BaseModel):
#     items: List[OrderItemResponse]
#     total_amount: float

#     class Config:
#         from_attributes = True
class OrderResponse(BaseModel):
    id: int
    created_at: datetime
    total_amount: float
    items: List[OrderItemResponse] = Field(alias="orderitems")

    class Config:
        from_attributes = True


    # total: float
    # product_id: int
    # product_name: str
    # price: float
    # quantity: int
    # total: float

    # class Config:
    #     orm_mode = True


# class PostBase(BaseModel):
#     # id: int
#     title: str
#     content: str
#     published: bool = True
#     # created_at: timedate


# class PostCreate(PostBase):
#     pass

# class Post(PostBase):
#     id: int
#     created_at: datetime

#     # class Config:
#     #     orm_mode = True

# # class UserBase(BaseModel):
# #     # id: int
# #     email: EmailStr
# #     password: str
#     # created_at: datetime


# class UserCreate(BaseModel):
#     email: EmailStr
#     password: str


# class User(BaseModel):
#     id: int
#     email: EmailStr
#     # password: str
#     created_at: datetime

# class Userlogin(BaseModel):
#     email: EmailStr
#     password: str

# class Token(BaseModel):
#     access_token: str
#     token_type: str



from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# from pydantic.types import conint

class ProductBase(BaseModel):
    name: str
    description: str
    price: float
    
class Product(BaseModel):
    id: int
    name: str
    description: str
    price: float


class UserBase(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

class UserA(BaseModel):
    id: int
    email: EmailStr
    role: str
    created_at: datetime

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



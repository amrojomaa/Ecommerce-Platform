from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import datetime
from typing import List, Optional, Union
from enum import Enum

# from pydantic.types import conint

class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"
    CUSTOMER = "customer"
    DRIVER = "driver"

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
    id: Optional[int] = None
    name: str
    description: str
    price: float
    quantity: int
    category_name: str
    images: Optional[List[str]] = []

    class Config:
        orm_mode = True
    
class Product(BaseModel):
    id: Optional[int] = None
    name: str
    description: str
    price: float
    quantity: int
    category_name: str
    images: Optional[List[str]] = []

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
    profile_image: Optional[str] = None
    role: Optional[str] = "customer"  # Default role for new users
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ["admin", "employee", "customer", "driver"]:
            raise ValueError('Role must be one of: admin, employee, customer, driver')
        return v
    
    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    first_name: str
    last_name: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    street: Optional[str] = None
    profile_image: Optional[str] = None
    role: Optional[str] = None  # Role can be updated by admin
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ["admin", "employee", "customer", "driver"]:
            raise ValueError('Role must be one of: admin, employee, customer, driver')
        return v
    
    class Config:
        orm_mode = True

class User(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    street: Optional[str] = None
    profile_image: Optional[str] = None
    role: str  # admin, employee, or customer
    is_verified: bool
    created_at: datetime
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ["admin", "employee", "customer", "driver"]:
            raise ValueError('Role must be one of: admin, employee, customer, driver')
        return v

    class Config:
        orm_mode = True


class TokenData(BaseModel):
    id: Optional[int] = None
    token_version: Optional[int] = 0


class AddCart(BaseModel):
    product_name: str
    quantity: int


class ShowCartOut(BaseModel):
    name: str
    price: float
    images: Optional[List[str]] = []
    # quantity: int
    # total: float

    class Config:
        orm_mode = True

class ShowCart(BaseModel):
    id: int
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
    images: Optional[List[str]] = []

    class Config:
        orm_mode = True

class Updateoutputcart(BaseModel):
    product: UpdateCartOut
    quantity: int
    total: float


class Orderitemname(BaseModel):
    name: str
    images: Optional[List[str]] = Field(default_factory=list)
    
    @field_validator('images', mode='before')
    @classmethod
    def convert_images(cls, v):
        """Convert DBProductImage objects to image_path strings"""
        if v is None:
            return []
        if isinstance(v, list):
            # If list contains DBProductImage objects, extract image_path
            if len(v) > 0 and hasattr(v[0], 'image_path'):
                return [img.image_path for img in v]
            # If already strings, return as is
            return v
        return []
    
    class Config:
        from_attributes = True
        arbitrary_types_allowed = True

 
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
    status: str
    items: List[OrderItemResponse] = Field(alias="orderitems")

    class Config:
        from_attributes = True

class CheckoutRequest(BaseModel):
    address: str
    city: str
    state: Optional[str] = None
    zipCode: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None


class OrderUserInfo(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryPhotoResponse(BaseModel):
    id: int
    photo_type: str
    image_path: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminOrderDeliverySummary(BaseModel):
    issue_type: Optional[str] = None
    issue_description: Optional[str] = None
    issue_resolved: bool = False
    photos: List[DeliveryPhotoResponse] = []

    class Config:
        from_attributes = True


class AdminOrderResponse(BaseModel):
    id: int
    created_at: datetime
    total_amount: float
    status: str
    items: List[OrderItemResponse] = Field(alias="orderitems")
    user: Optional[OrderUserInfo] = None
    order_delivery: Optional[AdminOrderDeliverySummary] = Field(default=None, alias="delivery_job")

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

class PaymentIntentCreate(BaseModel):
    amount: float
    order_id: Optional[int] = None
    currency: str = "usd"

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str

class PaymentConfirm(BaseModel):
    payment_intent_id: str
    order_id: Optional[int] = None

class EmailVerification(BaseModel):
    email: EmailStr
    verification_code: str

class OrderStatusUpdate(BaseModel):
    status: str

class GoogleAuth(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetCode(BaseModel):
    email: EmailStr
    verification_code: str

class ResetPassword(BaseModel):
    email: EmailStr
    verification_code: str
    new_password: str

class UserRoleUpdate(BaseModel):
    role: str
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ["admin", "employee", "customer", "driver"]:
            raise ValueError('Role must be one of: admin, employee, customer, driver')
        return v


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    products: List[Product] = []
    session_id: str


class ClearChatRequest(BaseModel):
    session_id: Optional[str] = None


# Wishlist Schemas
class AddWishlist(BaseModel):
    product_name: str


class WishlistProductOut(BaseModel):
    name: str
    price: float
    category_name: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = []


class WishlistItemOut(BaseModel):
    id: int
    product: WishlistProductOut

    class Config:
        orm_mode = True


class WishlistResponse(BaseModel):
    items: List[WishlistItemOut]

    class Config:
        orm_mode = True


# Ticket Schemas
class TicketStatus(str, Enum):
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class TicketCreate(BaseModel):
    title: str
    description: str


class TicketResponseUser(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    
    class Config:
        from_attributes = True


class TicketResponseMessage(BaseModel):
    id: int
    message: str
    created_at: datetime
    user: TicketResponseUser
    
    class Config:
        from_attributes = True


class TicketBase(BaseModel):
    id: int
    title: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
    customer_id: int
    employee_id: Optional[int] = None
    customer: TicketResponseUser
    employee: Optional[TicketResponseUser] = None
    responses: List[TicketResponseMessage] = []
    assigned_by: Optional[int] = None
    assigned_at: Optional[datetime] = None
    pending_delete: Optional[bool] = False
    delete_requested_by: Optional[int] = None
    delete_requested_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TicketAssign(BaseModel):
    employee_id: int


class TicketStatusUpdate(BaseModel):
    status: str
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v not in ["In Progress", "Resolved", "Closed"]:
            raise ValueError('Status must be one of: In Progress, Resolved, Closed')
        return v


class TicketResponseCreate(BaseModel):
    message: str


# Comment Schemas
class CommentCreate(BaseModel):
    content: str
    product_id: Optional[int] = None  # Optional since it comes from URL path


class CommentUser(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_image: Optional[str] = None
    
    class Config:
        from_attributes = True


class CommentDisplay(BaseModel):
    id: int
    content: str
    sentiment: Optional[str] = None  # 'positive', 'neutral', or 'negative'
    created_at: datetime
    user: CommentUser
    
    class Config:
        from_attributes = True


# Rating Schemas
class RatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating must be between 1 and 5")
    product_id: Optional[int] = None  # Optional since it comes from URL path


class RatingUser(BaseModel):
    id: int
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class RatingDisplay(BaseModel):
    id: int
    rating: int
    created_at: datetime
    updated_at: datetime
    user: RatingUser
    
    class Config:
        from_attributes = True


class ProductRatingSummary(BaseModel):
    average_rating: float
    total_ratings: int
    user_rating: Optional[int] = None  # Current user's rating if authenticated
    
    class Config:
        from_attributes = True


# Admin Settings Schemas
class LowStockThresholdUpdate(BaseModel):
    threshold: int = Field(..., ge=1, description="Low stock threshold must be at least 1")


class LowStockThresholdResponse(BaseModel):
    threshold: int
    
    class Config:
        from_attributes = True


# Sentiment Analytics Schemas
class ProductSentimentAnalytics(BaseModel):
    product_id: int
    total_reviews: int
    positive_count: int
    neutral_count: int
    negative_count: int
    
    class Config:
        from_attributes = True


# Delivery / Driver Schemas
class DeliveryJobStatus(str, Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    DELIVERING = "delivering"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class DriverLocationResponse(BaseModel):
    driver_id: int
    latitude: float
    longitude: float
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryChatMessageResponse(BaseModel):
    id: int
    delivery_job_id: int
    sender_id: int
    sender_name: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryChatMessageCreate(BaseModel):
    message: str


class DeliveryJobCustomer(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: Optional[str] = None
    city: Optional[str] = None
    street: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryJobItemResponse(BaseModel):
    id: int
    product: Orderitemname
    quantity: int
    price: float
    total: float

    class Config:
        from_attributes = True


class DeliveryJobResponse(BaseModel):
    id: int
    order_id: int
    driver_id: Optional[int] = None
    status: str
    pickup_address: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    delivery_address: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    payment_amount: float
    issue_type: Optional[str] = None
    issue_description: Optional[str] = None
    issue_resolved: bool = False
    issue_resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[DeliveryJobCustomer] = None
    items: List[DeliveryJobItemResponse] = []
    photos: List[DeliveryPhotoResponse] = []

    class Config:
        from_attributes = True


class IssueReport(BaseModel):
    issue_type: str  # 'customer_not_home', 'incorrect_address', 'damaged_items', 'other'
    description: Optional[str] = None

    @field_validator('issue_type')
    @classmethod
    def validate_issue_type(cls, v):
        valid = ['customer_not_home', 'incorrect_address', 'damaged_items', 'other']
        if v not in valid:
            raise ValueError(f'issue_type must be one of: {", ".join(valid)}')
        return v


class DeliveryIssueMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class DeliveryIssueMessageResponse(BaseModel):
    id: int
    delivery_job_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class EarningsSummary(BaseModel):
    today: float = 0.0
    this_week: float = 0.0
    this_month: float = 0.0
    total: float = 0.0
    total_deliveries: int = 0
    pending_payout: float = 0.0


class EarningRecord(BaseModel):
    id: int
    delivery_job_id: int
    amount: float
    status: str  # 'pending', 'paid'
    created_at: datetime

    class Config:
        from_attributes = True


class PayoutRequest(BaseModel):
    amount: Optional[float] = None  # None = request all pending


# Warehouse Address Settings
class WarehouseAddressUpdate(BaseModel):
    address: str = Field(..., min_length=1, description="Warehouse address string")


class WarehouseAddressResponse(BaseModel):
    address: str

    class Config:
        from_attributes = True


# Admin delivery job response with driver name
class AdminDeliveryJobResponse(BaseModel):
    id: int
    order_id: int
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    status: str
    pickup_address: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    delivery_address: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    payment_amount: float
    issue_type: Optional[str] = None
    issue_description: Optional[str] = None
    issue_resolved: bool = False
    issue_resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[DeliveryJobCustomer] = None
    items: List[DeliveryJobItemResponse] = []
    photos: List[DeliveryPhotoResponse] = []

    class Config:
        from_attributes = True
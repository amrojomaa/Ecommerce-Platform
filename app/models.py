from sqlalchemy import Column, Float, Integer, String, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql.expression import text
from sqlalchemy.sql.sqltypes import TIMESTAMP

from .database import Base


class DBCategory(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),nullable=False, server_default=text('now()'))

    products = relationship("DBProduct", back_populates="category")


class DBProduct(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),nullable=False, server_default=text('now()'))

    category_name = Column(String, ForeignKey("categories.name", ondelete="RESTRICT"), nullable=False)
    items = relationship("DBCartItem", back_populates="product")
    category = relationship("DBCategory", back_populates="products")
    images = relationship("DBProductImage", back_populates="product", cascade="all, delete-orphan")

    # published = Column(Boolean, server_default='TRUE', nullable=False)


class DBProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    image_path = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
    product = relationship("DBProduct", back_populates="images")

class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=True)  # Nullable for OAuth users
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    street = Column(String, nullable=True)
    role = Column(String, nullable=False, server_default="user")
    is_verified = Column(Boolean, nullable=False, server_default='FALSE')
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(TIMESTAMP(timezone=True), nullable=True)
    provider = Column(String, nullable=False, server_default="email")  # 'email' or 'google'
    google_id = Column(String, nullable=True, unique=True)  # Google user ID
    profile_image = Column(String, nullable=True)  # Profile image path
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    
    cart = relationship("DBCart", back_populates="user", cascade="all, delete",
                        uselist=False) #one cart per user
    order = relationship("DBOrder", back_populates="user", cascade="all, delete")




class DBCart(Base):
    __tablename__ = "carts"
    id = Column(Integer, primary_key=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser", back_populates="cart")
    items = relationship("DBCartItem", back_populates="cart", cascade="all, delete")

    @property
    def grand_total(self):
        return sum(item.total for item in self.items)
    

class DBCartItem(Base):

    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, nullable=False)
    quantity = Column(Integer, nullable=False, server_default=text("0"))

    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    product = relationship("DBProduct", back_populates="items")

    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    cart = relationship("DBCart", back_populates="items")
 
    @property
    def total(self):
        return float(self.product.price * self.quantity)
    


class DBOrder(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    total_amount = Column(Float, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, server_default="created")

    user = relationship("DBUser", back_populates="order")
    orderitems = relationship("DBOrderItem", back_populates="order", cascade="all, delete")


class DBOrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10,2), nullable=False)  
    total = Column(Numeric(10,2), nullable=False)  

    order = relationship("DBOrder", back_populates="orderitems")
    product = relationship("DBProduct")
from sqlalchemy import Column, Float, Integer, String, Boolean, ForeignKey, Numeric, UniqueConstraint
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
    comments = relationship("DBComment", back_populates="product", cascade="all, delete-orphan")
    ratings = relationship("DBProductRating", back_populates="product", cascade="all, delete-orphan")

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
    role = Column(String, nullable=False, server_default="customer")
    is_verified = Column(Boolean, nullable=False, server_default='FALSE')
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(TIMESTAMP(timezone=True), nullable=True)
    provider = Column(String, nullable=False, server_default="email")  # 'email' or 'google'
    google_id = Column(String, nullable=True, unique=True)  # Google user ID
    profile_image = Column(String, nullable=True)  # Profile image path
    token_version = Column(Integer, nullable=False, server_default=text('0'))  # Token version for session invalidation
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    
    cart = relationship("DBCart", back_populates="user", cascade="all, delete",
                        uselist=False) #one cart per user
    order = relationship("DBOrder", foreign_keys="DBOrder.user_id", back_populates="user", cascade="all, delete")
    wishlist = relationship("DBWishlist", back_populates="user", cascade="all, delete",
                           uselist=False) #one wishlist per user
    customer_tickets = relationship("DBTicket", foreign_keys="DBTicket.customer_id", back_populates="customer", cascade="all, delete")
    employee_tickets = relationship("DBTicket", foreign_keys="DBTicket.employee_id", back_populates="employee")
    ticket_responses = relationship("DBTicketResponse", back_populates="user", cascade="all, delete")
    comments = relationship("DBComment", back_populates="user", cascade="all, delete")
    ratings = relationship("DBProductRating", back_populates="user", cascade="all, delete")




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
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("DBUser", back_populates="order", foreign_keys=[user_id])
    driver = relationship("DBUser", foreign_keys=[driver_id])
    orderitems = relationship("DBOrderItem", back_populates="order", cascade="all, delete")
    delivery_job = relationship("DBDeliveryJob", back_populates="order", uselist=False)


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


class DBWishlist(Base):
    __tablename__ = "wishlists"
    id = Column(Integer, primary_key=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    user = relationship("DBUser", back_populates="wishlist")
    items = relationship("DBWishlistItem", back_populates="wishlist", cascade="all, delete")


class DBWishlistItem(Base):
    __tablename__ = "wishlist_items"
    id = Column(Integer, primary_key=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    product = relationship("DBProduct")
    wishlist_id = Column(Integer, ForeignKey("wishlists.id", ondelete="CASCADE"), nullable=False)
    wishlist = relationship("DBWishlist", back_populates="items")
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))


class DBTicket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default="In Progress")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    customer = relationship("DBUser", foreign_keys=[customer_id])
    
    employee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    employee = relationship("DBUser", foreign_keys=[employee_id])
    
    # Assignment tracking
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Delete request fields
    pending_delete = Column(Boolean, nullable=False, server_default='FALSE')
    delete_requested_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    delete_requested_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Track who last updated the ticket (for notification purposes)
    last_updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    responses = relationship("DBTicketResponse", back_populates="ticket", cascade="all, delete-orphan")


class DBTicketResponse(Base):
    __tablename__ = "ticket_responses"
    id = Column(Integer, primary_key=True, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    ticket = relationship("DBTicket", back_populates="responses")
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser")


class DBComment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, nullable=False)
    content = Column(String, nullable=False)
    sentiment = Column(String, nullable=True)  # 'positive', 'neutral', or 'negative'
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    product = relationship("DBProduct", back_populates="comments")
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser", back_populates="comments")


class DBProductRating(Base):
    __tablename__ = "product_ratings"
    id = Column(Integer, primary_key=True, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    product = relationship("DBProduct", back_populates="ratings")
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser", back_populates="ratings")
    
    # Ensure one rating per user per product
    __table_args__ = (
        UniqueConstraint('user_id', 'product_id', name='unique_user_product_rating'),
    )


class DBAdminSettings(Base):
    __tablename__ = "admin_settings"
    id = Column(Integer, primary_key=True, nullable=False)
    setting_key = Column(String, nullable=False, unique=True)
    setting_value = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))


class DBDeliveryJob(Base):
    __tablename__ = "delivery_jobs"
    id = Column(Integer, primary_key=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, nullable=False, server_default="available")  # available, assigned, picked_up, delivering, delivered, cancelled
    pickup_address = Column(String, nullable=True)
    pickup_latitude = Column(Float, nullable=True)
    pickup_longitude = Column(Float, nullable=True)
    delivery_address = Column(String, nullable=True)
    delivery_latitude = Column(Float, nullable=True)
    delivery_longitude = Column(Float, nullable=True)
    payment_amount = Column(Float, nullable=False, server_default=text('0'))
    issue_type = Column(String, nullable=True)
    issue_description = Column(String, nullable=True)
    issue_resolved = Column(Boolean, nullable=False, server_default='FALSE')
    issue_resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    issue_resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    order = relationship("DBOrder", back_populates="delivery_job")
    driver = relationship("DBUser", foreign_keys=[driver_id])
    issue_resolver = relationship("DBUser", foreign_keys=[issue_resolved_by])
    photos = relationship("DBDeliveryPhoto", back_populates="delivery_job", cascade="all, delete-orphan")
    messages = relationship("DBDeliveryChatMessage", back_populates="delivery_job", cascade="all, delete-orphan")
    issue_messages = relationship("DBDeliveryIssueMessage", back_populates="delivery_job", cascade="all, delete-orphan")


class DBDeliveryChatMessage(Base):
    __tablename__ = "delivery_chat_messages"
    id = Column(Integer, primary_key=True, nullable=False)
    delivery_job_id = Column(Integer, ForeignKey("delivery_jobs.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    is_edited = Column(Boolean, nullable=False, server_default='FALSE')
    is_deleted = Column(Boolean, nullable=False, server_default='FALSE')

    delivery_job = relationship("DBDeliveryJob", back_populates="messages")
    sender = relationship("DBUser", foreign_keys=[sender_id])
    reactions = relationship("DBDeliveryChatReaction", back_populates="message_obj", cascade="all, delete-orphan")


class DBDeliveryChatReaction(Base):
    __tablename__ = "delivery_chat_reactions"
    id = Column(Integer, primary_key=True, nullable=False)
    message_id = Column(Integer, ForeignKey("delivery_chat_messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String(16), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    message_obj = relationship("DBDeliveryChatMessage", back_populates="reactions")
    user = relationship("DBUser", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint('message_id', 'user_id', name='uq_delivery_chat_reaction_message_user'),
    )


class DBDriverLocation(Base):
    __tablename__ = "driver_locations"
    id = Column(Integer, primary_key=True, nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    driver = relationship("DBUser", foreign_keys=[driver_id])


class DBDeliveryPhoto(Base):
    __tablename__ = "delivery_photos"
    id = Column(Integer, primary_key=True, nullable=False)
    delivery_job_id = Column(Integer, ForeignKey("delivery_jobs.id", ondelete="CASCADE"), nullable=False)
    photo_type = Column(String, nullable=False)  # 'pickup' or 'delivery'
    image_path = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    delivery_job = relationship("DBDeliveryJob", back_populates="photos")


class DBDriverEarning(Base):
    __tablename__ = "driver_earnings"
    id = Column(Integer, primary_key=True, nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delivery_job_id = Column(Integer, ForeignKey("delivery_jobs.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False, server_default="pending")  # 'pending', 'paid'
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    driver = relationship("DBUser", foreign_keys=[driver_id])
    delivery_job = relationship("DBDeliveryJob", foreign_keys=[delivery_job_id])


class DBDeliveryIssueMessage(Base):
    __tablename__ = "delivery_issue_messages"
    id = Column(Integer, primary_key=True, nullable=False)
    delivery_job_id = Column(Integer, ForeignKey("delivery_jobs.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    delivery_job = relationship("DBDeliveryJob", back_populates="issue_messages")
    sender = relationship("DBUser", foreign_keys=[sender_id])
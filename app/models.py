from sqlalchemy import Column, Float, Integer, String, Boolean, ForeignKey, Numeric, Index, JSON, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql.expression import text
from sqlalchemy.sql.sqltypes import TIMESTAMP, Text

from .database import Base


class InteractionEventType:
    VIEW = "view"
    SEARCH = "search"
    WISHLIST = "wishlist"
    ADD_TO_CART = "add_to_cart"
    PURCHASE = "purchase"


class DBUserInteraction(Base):
    """Append-only behavioral log for recommendation and analytics."""

    __tablename__ = "user_interactions"
    __table_args__ = (
        Index("ix_user_interactions_user_time", "user_id", "created_at"),
        Index("ix_user_interactions_product", "product_id"),
        Index("ix_user_interactions_event", "event_type"),
    )

    id = Column(Integer, primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    event_type = Column(String(32), nullable=False)
    query_text = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class DBRecommendationBatchCache(Base):
    """Precomputed batch recommendations per user (hybrid breakdown stored in payload)."""

    __tablename__ = "recommendation_batch_cache"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    payload = Column(JSON, nullable=False)
    computed_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))



class DBCategory(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False, unique=True)
    name_ar = Column(String, nullable=True)
    name_fr = Column(String, nullable=True)
    description = Column(String, nullable=False)
    description_ar = Column(String, nullable=True)
    description_fr = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True),nullable=False, server_default=text('now()'))

    products = relationship("DBProduct", back_populates="category")


class DBProduct(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False, unique=True)
    name_ar = Column(String, nullable=True)
    name_fr = Column(String, nullable=True)
    description = Column(String, nullable=False)
    description_ar = Column(String, nullable=True)
    description_fr = Column(String, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    discount_enabled = Column(Boolean, nullable=False, server_default='FALSE')
    discount_type = Column(String, nullable=True)  # "percentage" or "fixed"
    discount_value = Column(Numeric(10, 2), nullable=True, server_default=text('0'))
    quantity = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),nullable=False, server_default=text('now()'))

    category_name = Column(String, ForeignKey("categories.name", ondelete="RESTRICT"), nullable=False)
    items = relationship("DBCartItem", back_populates="product")
    category = relationship("DBCategory", back_populates="products")
    images = relationship("DBProductImage", back_populates="product", cascade="all, delete-orphan")
    comments = relationship("DBComment", back_populates="product", cascade="all, delete-orphan")
    ratings = relationship("DBProductRating", back_populates="product", cascade="all, delete-orphan")

    # published = Column(Boolean, server_default='TRUE', nullable=False)

    @property
    def discounted_price(self):
        original_price = float(self.price or 0)
        if not self.discount_enabled:
            return original_price

        discount_value = float(self.discount_value or 0)
        if self.discount_type == "percentage":
            discount_amount = original_price * (discount_value / 100)
        elif self.discount_type == "fixed":
            discount_amount = discount_value
        else:
            discount_amount = 0

        final_price = original_price - discount_amount
        if final_price < 0:
            final_price = 0
        return round(final_price, 2)

    @property
    def final_price(self):
        return self.discounted_price


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
    is_blocked = Column(Boolean, nullable=False, server_default='FALSE')
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
    customer_feedback = relationship(
        "DBCustomerFeedback",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    installment_requests = relationship(
        "DBInstallmentRequest",
        foreign_keys="DBInstallmentRequest.user_id",
        back_populates="user",
        cascade="all, delete",
    )
    reviewed_installment_requests = relationship(
        "DBInstallmentRequest",
        foreign_keys="DBInstallmentRequest.reviewed_by",
        back_populates="reviewer",
    )
    installment_payments_marked = relationship(
        "DBInstallmentPayment",
        foreign_keys="DBInstallmentPayment.marked_by",
        back_populates="marked_by_user",
    )




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
        return float(self.product.final_price * self.quantity)
    


class DBOrder(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    total_amount = Column(Float, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, server_default="created")
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sale_channel = Column(String, nullable=False, server_default="online")
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payment_method = Column(String, nullable=True)
    promotion_discount = Column(Float, nullable=False, server_default=text("0"))
    promotion_name = Column(String, nullable=True)
    customer_name = Column(String, nullable=True)

    user = relationship("DBUser", back_populates="order", foreign_keys=[user_id])
    driver = relationship("DBUser", foreign_keys=[driver_id])
    cashier = relationship("DBUser", foreign_keys=[cashier_id])
    orderitems = relationship("DBOrderItem", back_populates="order", cascade="all, delete")
    delivery_job = relationship("DBDeliveryJob", back_populates="order", uselist=False)
    installment_requests = relationship("DBInstallmentRequest", back_populates="order")
    warehouse_issues = relationship("DBWarehouseIssue", back_populates="order", cascade="all, delete")


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
    assigned_by_user = relationship("DBUser", foreign_keys=[assigned_by])
    
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
    is_chat = Column(Boolean, nullable=False, server_default='FALSE')
    ticket = relationship("DBTicket", back_populates="responses")
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser")


class DBComment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        UniqueConstraint('user_id', 'product_id', name='unique_user_product_comment'),
    )

    id = Column(Integer, primary_key=True, nullable=False)
    content = Column(String, nullable=False)
    sentiment = Column(String, nullable=True)  # 'positive', 'neutral', or 'negative'
    is_reported = Column(Boolean, nullable=False, server_default='FALSE')
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


class DBCustomerFeedback(Base):
    __tablename__ = "customer_feedback"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_customer_feedback_rating_range"),
    )

    id = Column(Integer, primary_key=True, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("DBUser", back_populates="customer_feedback")


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


class DBPromotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, server_default="FALSE")
    target_type = Column(String(16), nullable=False)  # "amount" or "quantity"
    target_value = Column(Numeric(10, 2), nullable=False)
    discount_type = Column(String(16), nullable=False)  # "percentage" or "fixed"
    discount_value = Column(Numeric(10, 2), nullable=False)
    filter_type = Column(String(32), nullable=False)  # include/exclude + product/category
    filter_values = Column(JSON, nullable=False, server_default=text("'[]'::jsonb"))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))


class DBInstallmentRequest(Base):
    __tablename__ = "installment_requests"

    id = Column(Integer, primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    duration_months = Column(Integer, nullable=False)
    status = Column(String(32), nullable=False, server_default="pending")  # pending, approved, rejected, completed
    total_amount = Column(Float, nullable=False)
    remaining_balance = Column(Float, nullable=False)
    monthly_payment = Column(Float, nullable=False)
    next_payment_date = Column(TIMESTAMP(timezone=True), nullable=True)
    user_note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))

    user = relationship("DBUser", foreign_keys=[user_id], back_populates="installment_requests")
    reviewer = relationship("DBUser", foreign_keys=[reviewed_by], back_populates="reviewed_installment_requests")
    order = relationship("DBOrder", back_populates="installment_requests")
    items = relationship("DBInstallmentRequestItem", back_populates="request", cascade="all, delete-orphan")
    documents = relationship("DBInstallmentDocument", back_populates="request", cascade="all, delete-orphan")
    schedules = relationship("DBInstallmentSchedule", back_populates="request", cascade="all, delete-orphan")
    payments = relationship("DBInstallmentPayment", back_populates="request", cascade="all, delete-orphan")


class DBInstallmentRequestItem(Base):
    __tablename__ = "installment_request_items"

    id = Column(Integer, primary_key=True, nullable=False)
    request_id = Column(Integer, ForeignKey("installment_requests.id", ondelete="CASCADE"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)

    request = relationship("DBInstallmentRequest", back_populates="items")
    order_item = relationship("DBOrderItem")
    product = relationship("DBProduct")


class DBInstallmentDocument(Base):
    __tablename__ = "installment_documents"

    id = Column(Integer, primary_key=True, nullable=False)
    request_id = Column(Integer, ForeignKey("installment_requests.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(32), nullable=False)  # id_front, id_back, selfie_with_id
    file_path = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    request = relationship("DBInstallmentRequest", back_populates="documents")


class DBInstallmentSchedule(Base):
    __tablename__ = "installment_schedules"

    id = Column(Integer, primary_key=True, nullable=False)
    request_id = Column(Integer, ForeignKey("installment_requests.id", ondelete="CASCADE"), nullable=False)
    installment_number = Column(Integer, nullable=False)
    due_date = Column(TIMESTAMP(timezone=True), nullable=False)
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, nullable=False, server_default=text("0"))
    status = Column(String(32), nullable=False, server_default="pending")  # pending, paid
    paid_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    request = relationship("DBInstallmentRequest", back_populates="schedules")
    payments = relationship("DBInstallmentPayment", back_populates="schedule")

    __table_args__ = (
        UniqueConstraint("request_id", "installment_number", name="uq_installment_request_installment_number"),
    )


class DBInstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True, nullable=False)
    request_id = Column(Integer, ForeignKey("installment_requests.id", ondelete="CASCADE"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("installment_schedules.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(Text, nullable=True)
    marked_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    paid_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    request = relationship("DBInstallmentRequest", back_populates="payments")
    schedule = relationship("DBInstallmentSchedule", back_populates="payments")
    marked_by_user = relationship("DBUser", foreign_keys=[marked_by], back_populates="installment_payments_marked")


class DBOrderItemVerification(Base):
    """Tracks verification status of each item during warehouse packing."""
    __tablename__ = "order_item_verifications"

    id = Column(Integer, primary_key=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False)
    verified = Column(Boolean, nullable=False, server_default='FALSE')
    verified_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    order = relationship("DBOrder", foreign_keys=[order_id])
    order_item = relationship("DBOrderItem", foreign_keys=[order_item_id])
    verifier = relationship("DBUser", foreign_keys=[verified_by])


class DBWarehouseIssue(Base):
    """Tracks issues reported by warehouse staff (missing/damaged items)."""
    __tablename__ = "warehouse_issues"

    id = Column(Integer, primary_key=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id", ondelete="CASCADE"), nullable=True)
    issue_type = Column(String, nullable=False)  # "missing", "damaged"
    description = Column(String, nullable=False)
    reported_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, nullable=False, server_default="open")  # "open", "resolved"
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    resolution_note = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    order = relationship("DBOrder", back_populates="warehouse_issues", foreign_keys=[order_id])
    order_item = relationship("DBOrderItem", foreign_keys=[order_item_id])
    reporter = relationship("DBUser", foreign_keys=[reported_by])
    resolver = relationship("DBUser", foreign_keys=[resolved_by])

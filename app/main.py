from fastapi import FastAPI, Request, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()
import traceback
import logging

from .database import SessionLocal, engine, get_db
from app import models
from .routers import Cart, Categories, login, products, users, order, payment, ai_assistant, Wishlist, ticket, comment, rating, admin_settings, delivery
from .config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if settings.auto_create_tables:
    models.Base.metadata.create_all(bind=engine)
    logger.warning("AUTO_CREATE_TABLES is enabled. Disable this in production and use migrations instead.")
else:
    logger.info("AUTO_CREATE_TABLES is disabled. Expecting managed schema migrations.")

def apply_schema_updates():
    """Apply lightweight schema updates for existing databases."""
    with engine.begin() as conn:
        conn.execute(text("""
            ALTER TABLE IF EXISTS delivery_jobs
                ADD COLUMN IF NOT EXISTS issue_resolved BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS issue_resolved_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS issue_resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS delivery_issue_messages (
                id SERIAL PRIMARY KEY,
                delivery_job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message VARCHAR NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_delivery_issue_messages_delivery_job_id
            ON delivery_issue_messages(delivery_job_id)
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_delivery_issue_messages_created_at
            ON delivery_issue_messages(created_at)
        """))

        conn.execute(text("""
            ALTER TABLE delivery_chat_messages
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS delivery_chat_reactions (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL REFERENCES delivery_chat_messages(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reaction VARCHAR(16) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_delivery_chat_reaction_message_user UNIQUE (message_id, user_id)
            )
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_delivery_chat_reactions_message_id
            ON delivery_chat_reactions(message_id)
        """))


def apply_schema_patches() -> None:
    """Apply additive schema patches for existing databases."""
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS driver_id INTEGER
                REFERENCES users(id) ON DELETE SET NULL
                """
            )
        )

        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS discount_type VARCHAR,
                ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) DEFAULT 0
                """
            )
        )


apply_schema_updates()
apply_schema_patches()
logger.info("Database connected successfully.")

app = FastAPI()

origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Custom exception handler to ensure CORS headers are always added
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Catch all other exceptions (including 500 errors) to ensure CORS headers are added
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception")
    logger.error(traceback.format_exc())
    
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(products.router)
app.include_router(users.router)
app.include_router(login.router)
app.include_router(Cart.router)
app.include_router(order.router)
app.include_router(Categories.router)
app.include_router(payment.router)
app.include_router(ai_assistant.router)
app.include_router(Wishlist.router)
app.include_router(ticket.router)
app.include_router(comment.router)
app.include_router(rating.router)
app.include_router(admin_settings.router)
app.include_router(delivery.router)

app.mount("/images", StaticFiles(directory="images"), name="images")

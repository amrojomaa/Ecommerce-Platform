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
from .routers import Cart, Categories, login, products, users, order, payment, ai_assistant, Wishlist, ticket, comment, rating, feedback, admin_settings, delivery, recommendations, pos, promotions, installments
from app.utils.image_storage import IMAGES_ROOT_DIR, ensure_images_root


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


IS_PRODUCTION = os.getenv("ENV", "").strip().lower() == "production"
RUN_STARTUP_SCHEMA_UPDATES = _env_bool("RUN_STARTUP_SCHEMA_UPDATES", not IS_PRODUCTION)
RUN_STARTUP_SCHEMA_PATCHES = _env_bool("RUN_STARTUP_SCHEMA_PATCHES", not IS_PRODUCTION)


def apply_schema_updates():
    """Apply lightweight schema updates for existing databases."""
    with engine.begin() as conn:
        conn.execute(text("""
            ALTER TABLE delivery_jobs
                ADD COLUMN IF NOT EXISTS issue_resolved BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS issue_resolved_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS issue_resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
            
            ALTER TABLE comments
                ADD COLUMN IF NOT EXISTS is_reported BOOLEAN NOT NULL DEFAULT FALSE;
            
            ALTER TABLE ticket_responses
                ADD COLUMN IF NOT EXISTS is_chat BOOLEAN NOT NULL DEFAULT FALSE;
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

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_interactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                event_type VARCHAR(32) NOT NULL,
                query_text TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))

        # Align legacy user_interactions tables with the current model:
        # drop any extra columns from prior schemas (e.g. signal_type) that have
        # NOT NULL constraints and would break inserts from the current code.
        conn.execute(text("""
            DO $$
            DECLARE
                col_name text;
                expected text[] := ARRAY[
                    'id', 'user_id', 'product_id',
                    'event_type', 'query_text', 'created_at'
                ];
            BEGIN
                FOR col_name IN
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'user_interactions'
                LOOP
                    IF NOT (col_name = ANY(expected)) THEN
                        EXECUTE format(
                            'ALTER TABLE user_interactions DROP COLUMN IF EXISTS %I CASCADE',
                            col_name
                        );
                    END IF;
                END LOOP;

                -- Make sure the columns we DO use exist (no-op if already there).
                ALTER TABLE user_interactions
                    ADD COLUMN IF NOT EXISTS event_type VARCHAR(32),
                    ADD COLUMN IF NOT EXISTS query_text TEXT,
                    ADD COLUMN IF NOT EXISTS product_id INTEGER;

                -- Backfill / enforce NOT NULL on event_type.
                UPDATE user_interactions SET event_type = 'view'
                    WHERE event_type IS NULL;
                ALTER TABLE user_interactions
                    ALTER COLUMN event_type SET NOT NULL;
            END$$;
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_interactions_user_time
            ON user_interactions(user_id, created_at)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_interactions_product
            ON user_interactions(product_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_interactions_event
            ON user_interactions(event_type)
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS recommendation_batch_cache (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))

if RUN_STARTUP_SCHEMA_UPDATES:
    apply_schema_updates()
models.Base.metadata.create_all(bind=engine)


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

        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS sale_channel VARCHAR(32) NOT NULL DEFAULT 'online'
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32)
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS promotion_discount DOUBLE PRECISION NOT NULL DEFAULT 0
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS orders
                ADD COLUMN IF NOT EXISTS promotion_name VARCHAR(255)
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS promotions (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    is_active BOOLEAN NOT NULL DEFAULT FALSE,
                    target_type VARCHAR(16) NOT NULL,
                    target_value NUMERIC(10, 2) NOT NULL,
                    discount_type VARCHAR(16) NOT NULL,
                    discount_value NUMERIC(10, 2) NOT NULL,
                    filter_type VARCHAR(32) NOT NULL,
                    filter_values JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS promotions
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS target_type VARCHAR(16),
                ADD COLUMN IF NOT EXISTS target_value NUMERIC(10, 2),
                ADD COLUMN IF NOT EXISTS discount_type VARCHAR(16),
                ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2),
                ADD COLUMN IF NOT EXISTS filter_type VARCHAR(32),
                ADD COLUMN IF NOT EXISTS filter_values JSONB,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET target_type = 'amount'
                WHERE target_type IS NULL OR btrim(target_type) = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET target_value = 1
                WHERE target_value IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET discount_type = 'percentage'
                WHERE discount_type IS NULL OR btrim(discount_type) = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET discount_value = 0
                WHERE discount_value IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET filter_type = 'include_products'
                WHERE filter_type IS NULL OR btrim(filter_type) = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE promotions
                SET filter_values = '[]'::jsonb
                WHERE filter_values IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS promotions
                ALTER COLUMN target_type SET DEFAULT 'amount',
                ALTER COLUMN target_value SET DEFAULT 1,
                ALTER COLUMN discount_type SET DEFAULT 'percentage',
                ALTER COLUMN discount_value SET DEFAULT 0,
                ALTER COLUMN filter_type SET DEFAULT 'include_products',
                ALTER COLUMN filter_values SET DEFAULT '[]'::jsonb
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS promotions
                ALTER COLUMN target_type SET NOT NULL,
                ALTER COLUMN target_value SET NOT NULL,
                ALTER COLUMN discount_type SET NOT NULL,
                ALTER COLUMN discount_value SET NOT NULL,
                ALTER COLUMN filter_type SET NOT NULL,
                ALTER COLUMN filter_values SET NOT NULL
                """
            )
        )

        # POS walk-in placeholder: old email fails Pydantic EmailStr (reserved .local TLD).
        connection.execute(
            text(
                """
                UPDATE users SET email = 'pos.walkin@example.com'
                WHERE email = 'pos.walkin@internal.local'
                """
            )
        )

        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS users
                ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS customer_feedback (
                    id SERIAL PRIMARY KEY,
                    rating INTEGER NOT NULL,
                    comment TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT ck_customer_feedback_rating_range CHECK (rating >= 1 AND rating <= 5)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE IF EXISTS customer_feedback
                DROP CONSTRAINT IF EXISTS uq_customer_feedback_user_id
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_requests_user_id
                ON installment_requests(user_id)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_requests_status
                ON installment_requests(status)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_schedules_request_due_date
                ON installment_schedules(request_id, due_date)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_documents_request_id
                ON installment_documents(request_id)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_payments_request_id
                ON installment_payments(request_id)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_users_profile_image
                ON users(profile_image)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_delivery_photos_image_path
                ON delivery_photos(image_path)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_installment_documents_file_path
                ON installment_documents(file_path)
                """
            )
        )

if RUN_STARTUP_SCHEMA_PATCHES:
    apply_schema_patches()
print("Data Base connected successfully!")

app = FastAPI()
ensure_images_root()

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

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
    # Log the full traceback for debugging
    logging.error("Unhandled exception: %s", exc)
    logging.error(traceback.format_exc())
    
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
app.include_router(feedback.router)
app.include_router(admin_settings.router)
app.include_router(delivery.router)
app.include_router(recommendations.router)
app.include_router(pos.router)
app.include_router(promotions.router)
app.include_router(installments.router)

app.mount("/images", StaticFiles(directory=str(IMAGES_ROOT_DIR)), name="images")

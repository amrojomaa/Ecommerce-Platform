from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .database import SessionLocal, engine, get_db
from app import models
from .routers import Cart, Categories, login, products, users, order, payment, ai_assistant

models.Base.metadata.create_all(bind=engine)
print("Data Base connected successfully!")

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(users.router)
app.include_router(login.router)
app.include_router(Cart.router)
app.include_router(order.router)
app.include_router(Categories.router)
app.include_router(payment.router)
app.include_router(ai_assistant.router)

app.mount("/images", StaticFiles(directory="images"), name="images")

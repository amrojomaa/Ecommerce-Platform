from fastapi import FastAPI, status, Response
from fastapi.staticfiles import StaticFiles
from .database import SessionLocal, engine, get_db
from app import models
from .routers import Cart, Categories, login, products, users, order
from fastapi.middleware.cors import CORSMiddleware


models.Base.metadata.create_all(bind=engine)
print("Data Base connected successfully!")

app=FastAPI()

app.include_router(products.router)
app.include_router(users.router)
app.include_router(login.router)
app.include_router(Cart.router)
app.include_router(order.router)
app.include_router(Categories.router)

app.mount("/images", StaticFiles(directory="images"), name="images")

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
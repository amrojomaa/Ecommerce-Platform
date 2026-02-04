from fastapi import FastAPI, status, Response
from .database import SessionLocal, engine, get_db
from app import models
from .routers import Cart, login, products, users, order

models.Base.metadata.create_all(bind=engine)
print("Data Base connected successfully!")

app=FastAPI()

app.include_router(products.router)
app.include_router(users.router)
app.include_router(login.router)
app.include_router(Cart.router)
app.include_router(order.router)

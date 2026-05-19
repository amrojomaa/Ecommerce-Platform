from app.database import engine
from sqlalchemy import text

def add_column():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE orders ADD COLUMN customer_name VARCHAR"))
            print("Successfully added customer_name to orders")
        except Exception as e:
            print("Error or already exists:", e)

if __name__ == "__main__":
    add_column()

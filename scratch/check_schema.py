from app.database import engine
from sqlalchemy import text

with engine.connect() as connection:
    result = connection.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'comments'"))
    for row in result:
        print(f"Column: {row[0]}, Type: {row[1]}")

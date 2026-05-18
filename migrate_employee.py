from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import SQLALCHEMY_DATABASE_URL
from app import models

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate_roles():
    db = SessionLocal()
    try:
        users = db.query(models.DBUser).filter(models.DBUser.role == 'employee').all()
        for user in users:
            user.role = 'support_agent'
        db.commit()
        print(f"Successfully migrated {len(users)} employees to support_agent.")
    except Exception as e:
        print(f"Error migrating: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_roles()

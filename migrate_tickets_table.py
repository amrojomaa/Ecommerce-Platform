"""
Migration script to add last_updated_by column to tickets table
Run this script to update your database schema
"""
from sqlalchemy import text
from app.database import engine, SessionLocal

def migrate_tickets_table():
    """Add last_updated_by column to tickets table"""
    db = SessionLocal()
    try:
        # Add the column if it doesn't exist
        db.execute(text("""
            ALTER TABLE tickets 
            ADD COLUMN IF NOT EXISTS last_updated_by INTEGER;
        """))
        
        # Check if foreign key constraint already exists
        result = db.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'tickets' 
            AND constraint_name = 'fk_tickets_last_updated_by';
        """))
        
        if not result.fetchone():
            # Add foreign key constraint
            db.execute(text("""
                ALTER TABLE tickets
                ADD CONSTRAINT fk_tickets_last_updated_by 
                FOREIGN KEY (last_updated_by) 
                REFERENCES users(id) 
                ON DELETE SET NULL;
            """))
        
        db.commit()
        print("Migration successful: last_updated_by column added to tickets table")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Running migration to add last_updated_by column...")
    migrate_tickets_table()
    print("Migration completed!")

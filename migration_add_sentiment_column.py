"""
Database Migration Script: Add sentiment column to comments table

This script adds a 'sentiment' column to the 'comments' table.
The sentiment column will store 'positive', 'neutral', or 'negative' values.

Run this script after updating the models to add the sentiment column to existing databases.

Usage:
    python migration_add_sentiment_column.py
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/fastapi")

def add_sentiment_column():
    """Add sentiment column to comments table"""
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Create a connection
        with engine.connect() as connection:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='comments' AND column_name='sentiment'
            """)
            result = connection.execute(check_query)
            
            if result.fetchone():
                print("Sentiment column already exists. Skipping migration.")
                return
            
            # Add sentiment column
            alter_query = text("""
                ALTER TABLE comments 
                ADD COLUMN sentiment VARCHAR
            """)
            connection.execute(alter_query)
            connection.commit()
            
            print("✅ Successfully added 'sentiment' column to 'comments' table.")
            print("Note: Existing comments will have NULL sentiment values.")
            print("Sentiment will be automatically calculated for new comments.")
            
    except Exception as e:
        print(f"❌ Error adding sentiment column: {e}")
        raise

if __name__ == "__main__":
    print("Starting migration: Adding sentiment column to comments table...")
    add_sentiment_column()
    print("Migration completed!")

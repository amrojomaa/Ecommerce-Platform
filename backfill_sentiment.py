"""
Backfill Sentiment Analysis Script

This script analyzes all existing comments that don't have sentiment values
and updates them with sentiment analysis results.

Usage:
    python backfill_sentiment.py
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from app.models import DBComment
from app.utils.sentiment_analysis import analyze_sentiment

# Load environment variables
load_dotenv()

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/fastapi")

def backfill_sentiments():
    """Analyze and update sentiment for all comments without sentiment"""
    try:
        # Create engine and session
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Get all comments without sentiment
            comments_without_sentiment = db.query(DBComment)\
                .filter(DBComment.sentiment.is_(None))\
                .all()
            
            total = len(comments_without_sentiment)
            
            if total == 0:
                print("✅ All comments already have sentiment values. Nothing to update.")
                return
            
            print(f"Found {total} comments without sentiment. Analyzing...")
            
            updated = 0
            for i, comment in enumerate(comments_without_sentiment, 1):
                try:
                    # Analyze sentiment
                    sentiment = analyze_sentiment(comment.content)
                    
                    # Update comment
                    comment.sentiment = sentiment
                    db.commit()
                    
                    updated += 1
                    if i % 10 == 0:
                        print(f"Processed {i}/{total} comments...")
                        
                except Exception as e:
                    print(f"Error processing comment {comment.id}: {e}")
                    db.rollback()
                    continue
            
            print(f"\n✅ Successfully updated {updated} out of {total} comments with sentiment analysis.")
            print(f"   - Positive: {sum(1 for c in comments_without_sentiment if c.sentiment == 'positive')}")
            print(f"   - Neutral: {sum(1 for c in comments_without_sentiment if c.sentiment == 'neutral')}")
            print(f"   - Negative: {sum(1 for c in comments_without_sentiment if c.sentiment == 'negative')}")
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Error backfilling sentiments: {e}")
        raise

if __name__ == "__main__":
    print("Starting sentiment backfill for existing comments...")
    backfill_sentiments()
    print("Backfill completed!")

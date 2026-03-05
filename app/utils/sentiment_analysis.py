"""
Sentiment Analysis Utility
Uses TextBlob for lightweight sentiment analysis of review text.
"""
from textblob import TextBlob


def analyze_sentiment(text: str) -> str:
    """
    Analyze the sentiment of a text and return 'positive', 'neutral', or 'negative'.
    
    Args:
        text: The text to analyze
        
    Returns:
        'positive', 'neutral', or 'negative'
    """
    if not text or not text.strip():
        return 'neutral'
    
    # Create TextBlob object and get polarity
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    
    # Classify sentiment based on polarity score
    # Polarity ranges from -1 (very negative) to 1 (very positive)
    if polarity > 0.1:
        return 'positive'
    elif polarity < -0.1:
        return 'negative'
    else:
        return 'neutral'

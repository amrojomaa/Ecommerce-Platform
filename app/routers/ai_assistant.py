import os
import re
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from ..database import get_db
from app import models, schemas
import google.generativeai as genai

router = APIRouter(
    prefix="/ai-assistant",
    tags=['AI Assistant']
)

# Initialize Google Gemini client
gemini_api_key = os.getenv("GEMINI_API_KEY", "")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

# In-memory session storage (in production, use Redis or database)
chat_sessions: Dict[str, Dict] = {}


def get_available_gemini_model() -> Optional[str]:
    """
    Try to find an available Gemini model by listing available models.
    Returns the first working model name or None.
    """
    if not gemini_api_key:
        return None
    
    # Try to list available models first
    try:
        available_models = genai.list_models()
        model_names_list = []
        
        for m in available_models:
            # Check if model supports generateContent
            if hasattr(m, 'supported_generation_methods') and "generateContent" in m.supported_generation_methods:
                # Extract model name (remove "models/" prefix if present)
                model_name = m.name.replace("models/", "")
                model_names_list.append(model_name)
        
        # Prefer these models in order
        preferred_models = [
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro-latest",
            "gemini-pro",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ]
        
        # Find first preferred model that's available
        for preferred in preferred_models:
            if preferred in model_names_list:
                return preferred
        
        # If none found, return first available model
        if model_names_list:
            return model_names_list[0]
    except Exception as e:
        # If listing fails, fallback to default
        pass
    
    # Fallback: return default model name (most common)
    return "gemini-pro"


def classify_intent(message: str, last_message: Optional[str] = None) -> str:
    """
    Classify if the message is product-related or general conversation.
    Returns: 'product' or 'conversation'
    """
    message_lower = message.lower()
    
    # Product-related keywords
    product_keywords = [
        'product', 'products', 'item', 'items', 'buy', 'purchase', 'shop', 'shopping',
        'sofa', 'sofas', 'chair', 'chairs', 'table', 'tables', 'furniture',
        'cheap', 'cheaper', 'expensive', 'price', 'prices', 'cost', 'affordable',
        'budget', 'under', 'below', 'show', 'find', 'search', 'recommend',
        'category', 'categories', 'discount', 'sale', 'deal'
    ]
    
    # Price-related patterns
    price_patterns = [
        r'\$\d+', r'\d+\s*dollars?', r'\d+\s*usd', r'under\s*\d+',
        r'below\s*\d+', r'less\s*than\s*\d+', r'max\s*\d+', r'maximum\s*\d+'
    ]
    
    # Check for product keywords
    if any(keyword in message_lower for keyword in product_keywords):
        return 'product'
    
    # Check for price patterns
    if any(re.search(pattern, message_lower) for pattern in price_patterns):
        return 'product'
    
    # Check for follow-up product queries
    if last_message:
        last_lower = last_message.lower()
        if any(keyword in last_lower for keyword in product_keywords):
            # Follow-up questions after product queries are likely product-related
            follow_up_keywords = ['cheaper', 'more', 'other', 'another', 'different', 'show', 'find', 'ones', 'these', 'those']
            if any(keyword in message_lower for keyword in follow_up_keywords):
                return 'product'
        
        # If last message was a product search result, follow-ups are likely product-related
        if 'found' in last_lower or 'product' in last_lower or 'recommend' in last_lower:
            return 'product'
    
    # Default to conversation
    return 'conversation'


def extract_product_intent(message: str) -> Dict:
    """
    Extract product search parameters from user message.
    Returns dict with: name, category, min_price, max_price
    """
    message_lower = message.lower()
    intent = {
        'name': None,
        'category': None,
        'min_price': None,
        'max_price': None
    }
    
    # Extract category keywords
    categories = ['sofa', 'sofas', 'chair', 'chairs', 'table', 'tables', 'furniture']
    for cat in categories:
        if cat in message_lower:
            if cat in ['sofa', 'sofas']:
                intent['category'] = 'sofa'
            elif cat in ['chair', 'chairs']:
                intent['category'] = 'chair'
            elif cat in ['table', 'tables']:
                intent['category'] = 'table'
            break
    
    # Extract price limits
    price_patterns = [
        (r'\$(\d+)', lambda m: float(m.group(1))),
        (r'(\d+)\s*dollars?', lambda m: float(m.group(1))),
        (r'(\d+)\s*usd', lambda m: float(m.group(1))),
        (r'under\s*(\d+)', lambda m: float(m.group(1))),
        (r'below\s*(\d+)', lambda m: float(m.group(1))),
        (r'less\s*than\s*(\d+)', lambda m: float(m.group(1))),
        (r'max\s*(\d+)', lambda m: float(m.group(1))),
        (r'maximum\s*(\d+)', lambda m: float(m.group(1))),
        (r'cheap', lambda m: 100.0),  # Default cheap threshold
    ]
    
    for pattern, extractor in price_patterns:
        match = re.search(pattern, message_lower)
        if match:
            price = extractor(match)
            if intent['max_price'] is None or price < intent['max_price']:
                intent['max_price'] = price
    
    # Extract product name (simple keyword matching)
    words = message_lower.split()
    product_names = []
    for word in words:
        if len(word) > 3 and word not in ['show', 'find', 'search', 'want', 'need', 'looking', 'for']:
            product_names.append(word)
    
    if product_names:
        intent['name'] = ' '.join(product_names[:2])  # Take first 2 words
    
    return intent


def search_products(db: Session, intent: Dict) -> List[models.DBProduct]:
    """
    Search products based on extracted intent.
    """
    query = db.query(models.DBProduct)
    
    filters = []
    
    if intent['name']:
        filters.append(models.DBProduct.name.ilike(f"%{intent['name']}%"))
    
    if intent['category']:
        filters.append(models.DBProduct.category_name.ilike(f"%{intent['category']}%"))
    
    if intent['max_price']:
        filters.append(models.DBProduct.price <= intent['max_price'])
    
    if intent['min_price']:
        filters.append(models.DBProduct.price >= intent['min_price'])
    
    if filters:
        query = query.filter(or_(*filters))
    
    # Limit results to 10 products
    products = query.limit(10).all()
    
    return products


def get_conversation_response(message: str, conversation_history: List[Dict] = None) -> str:
    """
    Get conversational response from Google Gemini.
    """
    if not gemini_api_key:
        return "I'm here to help! However, Google Gemini API key is not configured. Please contact support."
    
    try:
        # Get an available model
        model_name = get_available_gemini_model()
        
        if not model_name:
            return "I apologize, but I'm having trouble connecting to the AI service. Please check your API key and ensure you have access to Gemini models."
        
        # Try to initialize with system instruction first
        try:
            model = genai.GenerativeModel(
                model_name,
                system_instruction="You are a friendly and helpful AI assistant for an e-commerce store. You can help with general questions and product recommendations. Be conversational and helpful. Keep responses concise and under 200 words."
            )
        except:
            # Fallback to model without system instruction if it's not supported
            model = genai.GenerativeModel(model_name)
        
        # Build conversation history for Gemini (using chat format)
        chat_history = []
        
        # Add conversation history if available
        if conversation_history:
            for msg in conversation_history[-5:]:  # Last 5 messages for context
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    chat_history.append({"role": "user", "parts": [content]})
                elif role == "assistant":
                    chat_history.append({"role": "model", "parts": [content]})
        
        # Start a chat session with history
        chat = model.start_chat(history=chat_history)
        
        # Generate response
        response = chat.send_message(
            message,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=200,
                temperature=0.7,
            )
        )
        
        return response.text.strip()
    
    except Exception as e:
        # More detailed error message for debugging
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            return f"I apologize, but the AI model is not available. Please check your API key and ensure you have access to Gemini models. Error: {error_msg}"
        return f"I apologize, but I'm having trouble processing your request right now. Please try again later. Error: {error_msg}"


def get_product_with_images(product: models.DBProduct) -> dict:
    """Helper function to get product with images"""
    product_dict = {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": float(product.price),
        "quantity": product.quantity,
        "category_name": product.category_name,
        "images": [img.image_path for img in product.images] if hasattr(product, 'images') and product.images else []
    }
    return product_dict


@router.post("/chat", response_model=schemas.ChatResponse)
async def chat(
    chat_request: schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Main chat endpoint that handles both general conversation and product recommendations.
    """
    session_id = chat_request.session_id or "default"
    message = chat_request.message.strip()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty"
        )
    
    # Get or create session
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            "messages": [],
            "last_message": None,
            "last_intent": {}
        }
    
    session = chat_sessions[session_id]
    last_message = session.get("last_message")
    last_intent = session.get("last_intent", {})
    
    # Classify intent
    intent_type = classify_intent(message, last_message)
    
    response_text = ""
    products = []
    
    if intent_type == 'product':
        # Extract product intent
        intent = extract_product_intent(message)
        
        # For follow-up queries like "show cheaper ones", merge with previous intent
        if last_intent and ('cheaper' in message.lower() or 'more' in message.lower() or 'other' in message.lower()):
            # Preserve previous filters but update price if mentioned
            if not intent.get('name') and last_intent.get('name'):
                intent['name'] = last_intent['name']
            if not intent.get('category') and last_intent.get('category'):
                intent['category'] = last_intent['category']
            # Update max_price if "cheaper" is mentioned
            if 'cheaper' in message.lower() and last_intent.get('max_price'):
                # Reduce max price by 20% or use a lower threshold
                intent['max_price'] = min(intent.get('max_price', float('inf')), last_intent['max_price'] * 0.8)
        
        # Search products
        found_products = search_products(db, intent)
        
        # Store intent for next query
        session["last_intent"] = intent
        
        if found_products:
            products = [schemas.Product(**get_product_with_images(p)) for p in found_products]
            
            # Generate natural response with product count
            product_names = [p.name for p in found_products[:3]]
            if len(found_products) > 3:
                response_text = f"I found {len(found_products)} products matching your search. Here are some options: {', '.join(product_names)} and more!"
            else:
                response_text = f"I found {len(found_products)} product(s) for you: {', '.join(product_names)}"
        else:
            response_text = "I couldn't find any products matching your criteria. Could you try different search terms?"
    else:
        # General conversation - use OpenAI
        conversation_history = session.get("messages", [])
        response_text = get_conversation_response(message, conversation_history)
    
    # Update session
    session["last_message"] = message
    session["messages"].append({
        "role": "user",
        "content": message
    })
    session["messages"].append({
        "role": "assistant",
        "content": response_text
    })
    
    # Clean up old sessions (keep only last 100 messages per session)
    if len(session["messages"]) > 100:
        session["messages"] = session["messages"][-100:]
    
    return {
        "message": response_text,
        "products": products,
        "session_id": session_id
    }


@router.post("/chat/clear")
async def clear_chat_session(clear_request: schemas.ClearChatRequest):
    """
    Clear chat session history.
    """
    session_id = clear_request.session_id or "default"
    if session_id in chat_sessions:
        chat_sessions[session_id] = {
            "messages": [],
            "last_message": None,
            "last_intent": {}
        }
    return {"message": "Chat session cleared", "session_id": session_id}

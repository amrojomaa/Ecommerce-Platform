import os
import re
import string
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from ..database import get_db
from .. import models, schemas
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

# Avoid calling list_models() on every chat message (latency + possible quota noise)
_resolved_gemini_model: Optional[str] = None


def get_available_gemini_model() -> Optional[str]:
    """
    Try to find an available Gemini model by listing available models.
    Returns the first working model name or None.
    """
    global _resolved_gemini_model
    if not gemini_api_key:
        return None
    if _resolved_gemini_model:
        return _resolved_gemini_model

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
                _resolved_gemini_model = preferred
                return _resolved_gemini_model
        
        # If none found, return first available model
        if model_names_list:
            _resolved_gemini_model = model_names_list[0]
            return _resolved_gemini_model
    except Exception as e:
        # If listing fails, fallback to default
        pass
    
    # Fallback: return default model name (most common)
    _resolved_gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return _resolved_gemini_model


def classify_intent(message: str, last_message: Optional[str] = None) -> str:
    """
    Classify if the message is product-related or general conversation.
    Returns: 'product' or 'conversation'
    """
    message_lower = message.lower()

    # Price / budget questions should hit the catalog, not Gemini (saves quota + accurate stock)
    if re.search(r'\$\s*\d+', message_lower):
        return 'product'
    if re.search(r'\b(?:under|below|less\s+than)\s*\$?\s*\d+', message_lower):
        return 'product'
    
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

    # Existence / availability questions (often no word "product")
    existence_patterns = [
        r'\bdo you have\b',
        r'\bhave you got\b',
        r'\bdo you (?:sell|carry|stock)\b',
        r'\bis there (?:a|an|any)\s+\w+\s+(?:called|named)\b',
        r'\b(?:in stock|available|carry)\b',
    ]
    if any(re.search(p, message_lower) for p in existence_patterns):
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


# Words to ignore when inferring a product name from free text
_NAME_STOP_WORDS = frozenset({
    'show', 'find', 'search', 'want', 'need', 'looking', 'for', 'the', 'a', 'an', 'is', 'are',
    'there', 'here', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where',
    'why', 'how', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'would', 'should',
    'will', 'with', 'from', 'your', 'our', 'any', 'some', 'about', 'into', 'onto', 'called',
    'named', 'product', 'products', 'item', 'items', 'like', 'just', 'also', 'only', 'very',
    'much', 'more', 'most', 'other', 'please', 'tell', 'me', 'know', 'if', 'we', 'you', 'they',
    'book', 'books', 'something', 'anything', 'store', 'shop', 'inventory', 'stock', 'still',
    'price', 'prices', 'priced', 'pricing', 'cost', 'costs', 'buck', 'bucks', 'usd', 'pay', 'budget',
    'dollar', 'dollars', 'than', 'less', 'under', 'below', 'max', 'maximum',
    'cheap', 'cheaper', 'cheapest', 'expensive', 'lowest', 'highest',
})

_PRICE_NOISE_TOKENS = frozenset(
    _NAME_STOP_WORDS
    | {'price', 'prices', 'priced', 'pricing', 'cost', 'costs', 'buck', 'bucks', 'usd', 'dollar', 'dollars', 'pay', 'budget', 'under', 'below', 'max', 'maximum'}
)


def _is_price_like_token(token: str) -> bool:
    """
    Return True for numeric/price tokens that should never become product name terms.
    Examples: "100", "$100", "100.50", "100usd"
    """
    t = token.strip().lower()
    if not t:
        return False
    if re.fullmatch(r'\$?\d+(?:\.\d+)?(?:usd|dollars?|bucks?)?', t):
        return True
    if re.fullmatch(r'\d+(?:\.\d+)?\$', t):
        return True
    return False


def extract_explicit_product_title(text: str) -> Optional[str]:
    """
    Pull the product title from phrases like 'product called X', 'named X', or quoted titles.
    """
    t = text.strip()
    patterns = [
        r'(?:product|products|item|items|book|books)\s+called\s+(.+)$',
        r'(?:product|products|item|items|book|books)\s+named\s+(.+)$',
        r'\bcalled\s+(.+)$',
        r'\bnamed\s+(.+)$',
        r'\btitled\s+(.+)$',
    ]
    for p in patterns:
        m = re.search(p, t, re.IGNORECASE | re.DOTALL)
        if not m:
            continue
        name = m.group(1).strip()
        name = name.strip('"\'' + string.whitespace)
        name = name.rstrip('?.!').strip()
        name = re.sub(r'\s+', ' ', name)
        if len(name) >= 2:
            return name
    # Quoted string anywhere in the message
    mq = re.search(r'["\']([^"\']{2,})["\']', t)
    if mq:
        return mq.group(1).strip()
    return None


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
        'max_price': None,
        'max_price_inclusive': True,
        'exact_price': None,
    }

    # Exact price queries, e.g.:
    # "with a price 50$", "price is $50", "priced 50", "for 50$"
    exact_price_match = re.search(
        r'\b(?:price|priced|cost|costs?)\s*(?:is|=|of|at)?\s*\$?\s*(\d+)\s*\$?\b',
        message_lower
    )
    if not exact_price_match:
        exact_price_match = re.search(r'\bfor\s*\$?\s*(\d+)\s*\$?\b', message_lower)
    if exact_price_match:
        exact_price = float(exact_price_match.group(1))
        intent['exact_price'] = exact_price
        intent['min_price'] = exact_price
        intent['max_price'] = exact_price
        intent['max_price_inclusive'] = True
    
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
    
    # Extract price limits with strict/inclusive precedence.
    # If strict terms are present ("under", "below", "less than"), keep strict (<) semantics.
    if intent['exact_price'] is None:
        strict_price_patterns = [
            r'under\s*\$?\s*(\d+)',
            r'below\s*\$?\s*(\d+)',
            r'less\s*than\s*\$?\s*(\d+)',
        ]
        inclusive_price_patterns = [
            r'\$(\d+)',
            r'(\d+)\s*\$',
            r'(\d+)\s*dollars?',
            r'(\d+)\s*usd',
            r'max\s*\$?\s*(\d+)',
            r'maximum\s*\$?\s*(\d+)',
        ]

        strict_prices: List[float] = []
        for pattern in strict_price_patterns:
            strict_prices.extend(float(m.group(1)) for m in re.finditer(pattern, message_lower))

        inclusive_prices: List[float] = []
        for pattern in inclusive_price_patterns:
            inclusive_prices.extend(float(m.group(1)) for m in re.finditer(pattern, message_lower))

        if strict_prices:
            intent['max_price'] = min(strict_prices)
            intent['max_price_inclusive'] = False
        elif inclusive_prices:
            intent['max_price'] = min(inclusive_prices)
            intent['max_price_inclusive'] = True

    explicit = extract_explicit_product_title(message)
    if explicit:
        intent['name'] = explicit
        return intent
    
    # Infer name from meaningful words (avoid "there product" from "Is there a product called …")
    words = re.findall(r"[a-z0-9$]+(?:'[a-z]+)?", message_lower)
    significant = []
    for w in words:
        if w in _NAME_STOP_WORDS or len(w) < 2:
            continue
        if _is_price_like_token(w):
            continue
        if w.isdigit():
            continue
        significant.append(w)
    if significant:
        intent['name'] = ' '.join(significant[:12])

    # "priced under $15" should not search name LIKE "%priced 15%" — only apply price filters
    if intent.get('max_price') is not None or intent.get('min_price') is not None:
        if intent.get('name'):
            tokens = intent['name'].lower().split()
            if tokens and all(
                t in _PRICE_NOISE_TOKENS or (t.isdigit() and len(t) <= 6) for t in tokens
            ):
                intent['name'] = None
    
    return intent


def search_products(db: Session, intent: Dict) -> List[models.DBProduct]:
    """
    Search products based on extracted intent.
    """
    query = db.query(models.DBProduct).options(joinedload(models.DBProduct.images))
    
    filters = []
    
    if intent['name']:
        filters.append(models.DBProduct.name.ilike(f"%{intent['name']}%"))
    
    if intent['category']:
        filters.append(models.DBProduct.category_name.ilike(f"%{intent['category']}%"))
    
    if intent['max_price'] is not None:
        if intent.get('max_price_inclusive', True):
            filters.append(models.DBProduct.price <= intent['max_price'])
        else:
            filters.append(models.DBProduct.price < intent['max_price'])
    
    if intent['min_price']:
        filters.append(models.DBProduct.price >= intent['min_price'])
    
    if filters:
        query = query.filter(and_(*filters))
    
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
        error_msg = str(e)
        el = error_msg.lower()
        if "429" in error_msg or "quota" in el or "resource exhausted" in el or ("rate" in el and "limit" in el):
            return (
                "The AI chat service has hit its usage limit right now (free tier is capped). "
                "You can still find products using the shop search and filters. "
                "For price questions like “under $15”, the assistant will search the catalog directly—try sending your message again, or wait a minute and retry."
            )
        if "404" in error_msg or "not found" in el:
            return (
                "I can't reach the configured AI model right now. "
                "Please check your Gemini API key and model access in Google AI Studio."
            )
        return (
            "I'm having trouble reaching the AI service. Please try again in a moment, "
            "or use the Products page to search the store."
        )


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
    ml = message.lower()
    if intent_type != 'product' and (
        re.search(r'\$\s*\d+', ml) or re.search(r'\b(?:under|below|less\s+than)\s*\$?\s*\d+', ml)
    ):
        intent_type = 'product'
    
    response_text = ""
    products = []
    
    if intent_type == 'product':
        # Direct handling for category list questions.
        if re.search(r'\b(categories|category)\b', message.lower()):
            categories = (
                db.query(models.DBCategory)
                .order_by(models.DBCategory.name.asc())
                .all()
            )
            if categories:
                category_names = ", ".join([c.name for c in categories])
                response_text = f"Available categories are: {category_names}."
            else:
                response_text = "I couldn't find any categories because the catalog is currently empty."

            session["last_intent"] = {"name": None, "category": None, "min_price": None, "max_price": None}
            session["last_message"] = message
            session["messages"].append({"role": "user", "content": message})
            session["messages"].append({"role": "assistant", "content": response_text})
            if len(session["messages"]) > 100:
                session["messages"] = session["messages"][-100:]
            return {
                "message": response_text,
                "products": [],
                "session_id": session_id
            }

        # Direct handling for "cheapest" style questions.
        if re.search(r'\b(cheapest|lowest(?:\s+priced|\s+price)?)\b', message.lower()):
            cheapest_products = (
                db.query(models.DBProduct)
                .options(joinedload(models.DBProduct.images))
                .order_by(models.DBProduct.price.asc())
                .limit(1)
                .all()
            )
            if cheapest_products:
                cheapest = cheapest_products[0]
                response_text = (
                    f"The cheapest product is {cheapest.name} at ${float(cheapest.price):.2f}."
                )
                products = [schemas.Product(**get_product_with_images(cheapest))]
            else:
                response_text = "I couldn't find any products because the catalog is currently empty."

            session["last_intent"] = {"name": None, "category": None, "min_price": None, "max_price": None}
            session["last_message"] = message
            session["messages"].append({"role": "user", "content": message})
            session["messages"].append({"role": "assistant", "content": response_text})
            if len(session["messages"]) > 100:
                session["messages"] = session["messages"][-100:]
            return {
                "message": response_text,
                "products": products,
                "session_id": session_id
            }

        # Direct handling for "most expensive" style questions.
        if re.search(r'\b(most\s+expensive|highest(?:\s+priced|\s+price)?)\b', message.lower()):
            expensive_products = (
                db.query(models.DBProduct)
                .options(joinedload(models.DBProduct.images))
                .order_by(models.DBProduct.price.desc())
                .limit(1)
                .all()
            )
            if expensive_products:
                priciest = expensive_products[0]
                response_text = (
                    f"The most expensive product is {priciest.name} at ${float(priciest.price):.2f}."
                )
                products = [schemas.Product(**get_product_with_images(priciest))]
            else:
                response_text = "I couldn't find any products because the catalog is currently empty."

            session["last_intent"] = {"name": None, "category": None, "min_price": None, "max_price": None}
            session["last_message"] = message
            session["messages"].append({"role": "user", "content": message})
            session["messages"].append({"role": "assistant", "content": response_text})
            if len(session["messages"]) > 100:
                session["messages"] = session["messages"][-100:]
            return {
                "message": response_text,
                "products": products,
                "session_id": session_id
            }

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
            if intent.get("max_price") is not None:
                # Give a precise, helpful response for budget queries.
                cheapest_products = (
                    db.query(models.DBProduct)
                    .options(joinedload(models.DBProduct.images))
                    .order_by(models.DBProduct.price.asc())
                    .limit(3)
                    .all()
                )
                if cheapest_products:
                    min_price = float(cheapest_products[0].price)
                    cheap_names = ", ".join([p.name for p in cheapest_products[:3]])
                    response_text = (
                        f"I couldn't find products under ${intent['max_price']:.2f}. "
                        f"The lowest priced item currently is ${min_price:.2f}. "
                        f"Here are affordable options: {cheap_names}."
                    )
                    products = [schemas.Product(**get_product_with_images(p)) for p in cheapest_products]
                else:
                    response_text = "I couldn't find any products because the catalog is currently empty."
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

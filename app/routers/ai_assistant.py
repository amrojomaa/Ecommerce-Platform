import os

from typing import Dict, List, Optional



from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session



from app.routers.products import get_product_with_images

from app.services.ai_search import (

    ChatIntent,

    ProductSearchIntent,

    SearchSessionContext,

    apply_follow_up,

    classify_intent,

    extract_product_intent,

    find_cheapest_products,

    find_most_expensive_products,

    format_budget_fallback,

    format_category_list,

    format_cheapest_response,

    format_empty_search,

    format_expensive_response,

    format_recommendation_results,

    format_search_results,

    is_follow_up_message,

    load_category_aliases,

    product_effective_price,

    recommend_products,

    search_products,

)

from app.services.ai_search.offline_fallback import offline_reply

from app.services.gemini_client import generate_chat_reply

from .. import models, schemas

from ..database import get_db



router = APIRouter(

    prefix="/ai-assistant",

    tags=["AI Assistant"],

)



chat_sessions: Dict[str, Dict] = {}





def _serialize_products(db: Session, products: List[models.DBProduct]) -> List[schemas.Product]:

    return [schemas.Product(**get_product_with_images(product)) for product in products]





def _ensure_session(session_id: str) -> Dict:

    if session_id not in chat_sessions:

        chat_sessions[session_id] = {

            "messages": [],

            "last_message": None,

            "last_intent_type": None,

            "last_search_intent": {},

            "last_result_ids": [],

            "last_result_prices": [],

        }

    return chat_sessions[session_id]





def _finalize_response(

    db: Session,

    session: Dict,

    session_id: str,

    message: str,

    response_text: str,

    products: List[models.DBProduct],

    *,

    intent_type: Optional[ChatIntent] = None,

    search_intent: Optional[ProductSearchIntent] = None,

) -> Dict:

    session["last_message"] = message

    if intent_type is not None:

        session["last_intent_type"] = intent_type.value

    if search_intent is not None:

        session["last_search_intent"] = search_intent.to_dict()

    session["last_result_ids"] = [product.id for product in products]

    session["last_result_prices"] = [product_effective_price(product) for product in products]



    session["messages"].append({"role": "user", "content": message})

    session["messages"].append({"role": "assistant", "content": response_text})

    if len(session["messages"]) > 100:

        session["messages"] = session["messages"][-100:]



    return {

        "message": response_text,

        "products": _serialize_products(db, products),

        "session_id": session_id,

    }





def _conversation_response(

    db: Session,

    message: str,

    conversation_history: List[Dict],

    intent_type: ChatIntent,

    *,

    policy_mode: bool = False,

) -> tuple[str, List[models.DBProduct]]:

    """

    Try Gemini first; on quota/outage fall back to catalog + rule-based replies.

    """

    reply = generate_chat_reply(

        message,

        conversation_history,

        policy_mode=policy_mode,

    )

    if reply:

        return reply, []



    return offline_reply(db, message, intent_type)





@router.post("/chat", response_model=schemas.ChatResponse)

async def chat(

    chat_request: schemas.ChatRequest,

    db: Session = Depends(get_db),

):

    session_id = chat_request.session_id or "default"

    message = chat_request.message.strip()



    if not message:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Message cannot be empty",

        )



    session = _ensure_session(session_id)

    ctx = SearchSessionContext.from_session(session)

    category_aliases = load_category_aliases(db)

    intent_type = classify_intent(message, ctx)



    products: List[models.DBProduct] = []

    search_intent: Optional[ProductSearchIntent] = None



    if intent_type == ChatIntent.CATEGORY_LIST:

        categories = db.query(models.DBCategory).order_by(models.DBCategory.name.asc()).all()

        response_text = format_category_list(categories)

        return _finalize_response(

            db, session, session_id, message, response_text, [],

            intent_type=ChatIntent.CATEGORY_LIST,

            search_intent=ProductSearchIntent(),

        )



    if intent_type == ChatIntent.PRICE_CHEAPEST:

        found = find_cheapest_products(db, limit=1)

        if found:

            products = found

            response_text = format_cheapest_response(found[0])

        else:

            response_text = "I couldn't find any products because the catalog is currently empty."

        return _finalize_response(

            db, session, session_id, message, response_text, products,

            intent_type=ChatIntent.PRICE_CHEAPEST,

            search_intent=ProductSearchIntent(),

        )



    if intent_type == ChatIntent.PRICE_EXPENSIVE:

        found = find_most_expensive_products(db, limit=1)

        if found:

            products = found

            response_text = format_expensive_response(found[0])

        else:

            response_text = "I couldn't find any products because the catalog is currently empty."

        return _finalize_response(

            db, session, session_id, message, response_text, products,

            intent_type=ChatIntent.PRICE_EXPENSIVE,

            search_intent=ProductSearchIntent(),

        )



    if intent_type == ChatIntent.PRODUCT_RECOMMENDATION:

        search_intent = extract_product_intent(message, category_aliases)

        if is_follow_up_message(message, ctx):

            search_intent = apply_follow_up(message, search_intent, ctx, category_aliases)

        products = recommend_products(db, search_intent)

        response_text = format_recommendation_results(products)

        return _finalize_response(

            db, session, session_id, message, response_text, products,

            intent_type=ChatIntent.PRODUCT_RECOMMENDATION,

            search_intent=search_intent,

        )



    if intent_type == ChatIntent.PRODUCT_SEARCH:

        search_intent = extract_product_intent(message, category_aliases)

        if is_follow_up_message(message, ctx):

            search_intent = apply_follow_up(message, search_intent, ctx, category_aliases)



        if not search_intent.is_searchable():

            response_text = format_empty_search(search_intent)

            return _finalize_response(

                db, session, session_id, message, response_text, [],

                intent_type=ChatIntent.PRODUCT_SEARCH,

                search_intent=search_intent,

            )



        products = search_products(db, search_intent)

        if products:

            response_text = format_search_results(products, search_intent)

        elif search_intent.max_price is not None:

            affordable = find_cheapest_products(db, limit=3)

            if affordable:

                products = affordable

                response_text = format_budget_fallback(search_intent, affordable)

            else:

                response_text = "I couldn't find any products because the catalog is currently empty."

        else:

            response_text = format_empty_search(search_intent)



        return _finalize_response(

            db, session, session_id, message, response_text, products,

            intent_type=ChatIntent.PRODUCT_SEARCH,

            search_intent=search_intent,

        )



    if intent_type == ChatIntent.STORE_POLICY:

        response_text, products = _conversation_response(

            db,

            message,

            session.get("messages", []),

            intent_type,

            policy_mode=True,

        )

        return _finalize_response(

            db, session, session_id, message, response_text, products,

            intent_type=ChatIntent.STORE_POLICY,

        )



    response_text, products = _conversation_response(

        db,

        message,

        session.get("messages", []),

        ChatIntent.GENERAL_CONVERSATION,

    )

    return _finalize_response(

        db, session, session_id, message, response_text, products,

        intent_type=ChatIntent.GENERAL_CONVERSATION,

    )





@router.post("/chat/clear")

async def clear_chat_session(clear_request: schemas.ClearChatRequest):

    session_id = clear_request.session_id or "default"

    if session_id in chat_sessions:

        chat_sessions[session_id] = {

            "messages": [],

            "last_message": None,

            "last_intent_type": None,

            "last_search_intent": {},

            "last_result_ids": [],

            "last_result_prices": [],

        }

    return {"message": "Chat session cleared", "session_id": session_id}



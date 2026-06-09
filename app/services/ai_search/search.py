from __future__ import annotations

from typing import Dict, List, Sequence

from sqlalchemy import Float, and_, case, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.routers.products import get_ratings_summary_by_product_ids

from .types import ProductSearchIntent, RankedProduct

SEARCH_RESULT_LIMIT = 10
CANDIDATE_POOL_LIMIT = 120


def effective_price_expr():
    price_f = cast(models.DBProduct.price, Float)
    discount_val = cast(func.coalesce(models.DBProduct.discount_value, 0), Float)
    discount_amt = case(
        (
            and_(
                models.DBProduct.discount_enabled.is_(True),
                models.DBProduct.discount_type == "percentage",
            ),
            price_f * (discount_val / 100.0),
        ),
        (
            and_(
                models.DBProduct.discount_enabled.is_(True),
                models.DBProduct.discount_type == "fixed",
            ),
            discount_val,
        ),
        else_=0.0,
    )
    return func.greatest(price_f - discount_amt, 0.0)


def _base_query(db: Session):
    return db.query(models.DBProduct).options(
        joinedload(models.DBProduct.images),
        joinedload(models.DBProduct.category),
    )


def _product_search_blob(product: models.DBProduct) -> str:
    parts = [
        product.name or "",
        product.name_ar or "",
        product.name_fr or "",
        product.description or "",
        product.description_ar or "",
        product.description_fr or "",
        product.category_name or "",
    ]
    if product.category:
        parts.extend(
            [
                product.category.name_ar or "",
                product.category.name_fr or "",
            ]
        )
    return " ".join(parts).lower()


def _term_match_score(term: str, blob: str, product: models.DBProduct) -> float:
    score = 0.0
    names = [
        product.name,
        product.name_ar,
        product.name_fr,
    ]
    for name in names:
        if not name:
            continue
        name_lower = name.lower()
        if name_lower == term:
            score += 40.0
        elif name_lower.startswith(term):
            score += 24.0
        elif term in name_lower:
            score += 16.0

    if term in (product.category_name or "").lower():
        score += 10.0
    if product.category:
        for field in (product.category.name_ar, product.category.name_fr):
            if field and term in field.lower():
                score += 10.0
                break

    if term in blob:
        score += 6.0

    return score


def _rank_products(
    products: Sequence[models.DBProduct],
    intent: ProductSearchIntent,
    ratings_map: Dict[int, dict],
) -> List[RankedProduct]:
    terms = list(intent.query_terms)
    if intent.query_text and not terms:
        terms = intent.query_text.lower().split()

    ranked: List[RankedProduct] = []
    for product in products:
        blob = _product_search_blob(product)
        score = 0.0

        if intent.query_text:
            query_lower = intent.query_text.lower()
            for name in (product.name, product.name_ar, product.name_fr):
                if not name:
                    continue
                name_lower = name.lower()
                if name_lower == query_lower:
                    score += 80.0
                elif query_lower in name_lower:
                    score += 35.0

        if terms:
            matched_terms = sum(1 for term in terms if term in blob)
            score += matched_terms * 12.0
            for term in terms:
                score += _term_match_score(term, blob, product)
            if matched_terms == len(terms) and terms:
                score += 20.0
        elif intent.category_name:
            score += 8.0

        rating = ratings_map.get(product.id, {})
        score += float(rating.get("average_rating", 0.0)) * 2.0
        score += min(int(rating.get("total_ratings", 0)), 50) * 0.05

        if product.quantity > 0:
            score += 4.0
        else:
            score -= 8.0

        if product.discount_enabled:
            score += 2.0

        ranked.append(RankedProduct(product=product, score=score))

    ranked.sort(key=lambda item: (-item.score, float(item.product.price)))
    return ranked


def _apply_hard_filters(query, intent: ProductSearchIntent, effective_price):
    if intent.category_name:
        query = query.filter(
            or_(
                models.DBProduct.category_name.ilike(f"%{intent.category_name}%"),
                models.DBProduct.category.has(
                    or_(
                        models.DBCategory.name_ar.ilike(f"%{intent.category_name}%"),
                        models.DBCategory.name_fr.ilike(f"%{intent.category_name}%"),
                    )
                ),
            )
        )

    if intent.on_sale_only:
        query = query.filter(models.DBProduct.discount_enabled.is_(True))

    if intent.in_stock_only:
        query = query.filter(models.DBProduct.quantity > 0)

    if intent.exclude_product_ids:
        query = query.filter(~models.DBProduct.id.in_(intent.exclude_product_ids))

    if intent.max_price is not None:
        if intent.max_price_inclusive:
            query = query.filter(effective_price <= intent.max_price)
        else:
            query = query.filter(effective_price < intent.max_price)

    if intent.min_price is not None:
        query = query.filter(effective_price >= intent.min_price)

    return query


def _text_filter_clause(term: str):
    pattern = f"%{term}%"
    return or_(
        models.DBProduct.name.ilike(pattern),
        models.DBProduct.name_ar.ilike(pattern),
        models.DBProduct.name_fr.ilike(pattern),
        models.DBProduct.description.ilike(pattern),
        models.DBProduct.description_ar.ilike(pattern),
        models.DBProduct.description_fr.ilike(pattern),
        models.DBProduct.category_name.ilike(pattern),
        models.DBProduct.category.has(
            or_(
                models.DBCategory.name_ar.ilike(pattern),
                models.DBCategory.name_fr.ilike(pattern),
            )
        ),
    )


def search_products(db: Session, intent: ProductSearchIntent) -> List[models.DBProduct]:
    """
    Search and rank products. Returns an empty list when intent has no meaningful filters.
    """
    if not intent.is_searchable():
        return []

    effective_price = effective_price_expr()
    query = _base_query(db)

    if intent.query_terms:
        query = query.filter(or_(*[_text_filter_clause(term) for term in intent.query_terms]))
    elif intent.query_text:
        query = query.filter(_text_filter_clause(intent.query_text))

    query = _apply_hard_filters(query, intent, effective_price)

    candidates = query.limit(CANDIDATE_POOL_LIMIT).all()
    if not candidates:
        return []

    ratings_map = get_ratings_summary_by_product_ids(db, [p.id for p in candidates])
    ranked = _rank_products(candidates, intent, ratings_map)
    return [item.product for item in ranked[:SEARCH_RESULT_LIMIT]]


def find_cheapest_products(db: Session, limit: int = 1) -> List[models.DBProduct]:
    effective_price = effective_price_expr()
    return (
        _base_query(db)
        .order_by(effective_price.asc(), models.DBProduct.id.asc())
        .limit(limit)
        .all()
    )


def find_most_expensive_products(db: Session, limit: int = 1) -> List[models.DBProduct]:
    effective_price = effective_price_expr()
    return (
        _base_query(db)
        .order_by(effective_price.desc(), models.DBProduct.id.asc())
        .limit(limit)
        .all()
    )


def recommend_products(
    db: Session,
    intent: ProductSearchIntent,
    *,
    limit: int = SEARCH_RESULT_LIMIT,
) -> List[models.DBProduct]:
    """
    Curated picks when the user asks for suggestions without specific search terms.
    """
    effective_price = effective_price_expr()
    query = _base_query(db).filter(models.DBProduct.quantity > 0)
    query = _apply_hard_filters(query, intent, effective_price)

    if not intent.category_name and not intent.max_price and not intent.min_price:
        query = query.filter(models.DBProduct.discount_enabled.is_(True))

    candidates = query.limit(CANDIDATE_POOL_LIMIT).all()
    if not candidates and intent.category_name:
        relaxed = ProductSearchIntent(category_name=intent.category_name)
        return search_products(db, relaxed)

    ratings_map = get_ratings_summary_by_product_ids(db, [p.id for p in candidates])
    ranked = _rank_products(candidates, intent, ratings_map)
    if not ranked:
        return []

    # Recommendation path: prioritize rating/stock/discount over text score.
    ranked.sort(
        key=lambda item: (
            -float(ratings_map.get(item.product.id, {}).get("average_rating", 0.0)),
            -int(ratings_map.get(item.product.id, {}).get("total_ratings", 0)),
            -int(item.product.discount_enabled),
            float(item.product.price),
        )
    )
    return [item.product for item in ranked[:limit]]


def product_effective_price(product: models.DBProduct) -> float:
    return float(product.discounted_price)

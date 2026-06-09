from __future__ import annotations

from typing import List

from app import models

from .types import ProductSearchIntent


def format_category_list(categories: List[models.DBCategory]) -> str:
    if not categories:
        return "I couldn't find any categories because the catalog is currently empty."
    names = ", ".join(category.name for category in categories)
    return f"Available categories are: {names}."


def format_cheapest_response(product: models.DBProduct) -> str:
    price = float(product.discounted_price)
    return f"The cheapest product is {product.name} at ${price:.2f}."


def format_expensive_response(product: models.DBProduct) -> str:
    price = float(product.discounted_price)
    return f"The most expensive product is {product.name} at ${price:.2f}."


def format_search_results(
    products: List[models.DBProduct],
    intent: ProductSearchIntent,
) -> str:
    if not products:
        return format_empty_search(intent)

    names = [product.name for product in products[:3]]
    if len(products) > 3:
        return (
            f"I found {len(products)} products matching your search. "
            f"Here are some options: {', '.join(names)} and more!"
        )
    return f"I found {len(products)} product(s) for you: {', '.join(names)}"


def format_recommendation_results(products: List[models.DBProduct]) -> str:
    if not products:
        return (
            "I don't have personalized picks right now. "
            "Try telling me a category or budget, for example “sofas under $500”."
        )
    names = [product.name for product in products[:3]]
    if len(products) > 3:
        return (
            f"Here are {len(products)} recommendations you might like: "
            f"{', '.join(names)} and more."
        )
    return f"Here are {len(products)} recommendations for you: {', '.join(names)}."


def format_empty_search(intent: ProductSearchIntent) -> str:
    if not intent.is_searchable():
        return (
            "What are you looking for? You can ask by product name, category, or budget "
            '(for example, "wooden table under $200").'
        )

    if intent.max_price is not None:
        comparator = "under" if not intent.max_price_inclusive else "up to"
        return (
            f"I couldn't find products {comparator} ${intent.max_price:.2f} with those criteria. "
            "Try a higher budget or different keywords."
        )

    return "I couldn't find any products matching your criteria. Could you try different search terms?"


def format_budget_fallback(
    intent: ProductSearchIntent,
    affordable: List[models.DBProduct],
) -> str:
    if not affordable:
        return "I couldn't find any products because the catalog is currently empty."

    min_price = float(affordable[0].discounted_price)
    names = ", ".join(product.name for product in affordable[:3])
    comparator = "under" if not intent.max_price_inclusive else "up to"
    return (
        f"I couldn't find products {comparator} ${intent.max_price:.2f}. "
        f"The lowest priced item currently is ${min_price:.2f}. "
        f"Here are affordable options: {names}."
    )


def policy_handoff_message() -> str:
    return (
        "I can help with store policies such as returns, shipping, and payments. "
        "What would you like to know?"
    )

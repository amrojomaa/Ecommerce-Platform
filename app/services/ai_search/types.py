from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional


class ChatIntent(str, Enum):
    PRODUCT_SEARCH = "product_search"
    PRODUCT_RECOMMENDATION = "product_recommendation"
    CATEGORY_LIST = "category_list"
    PRICE_CHEAPEST = "price_cheapest"
    PRICE_EXPENSIVE = "price_expensive"
    STORE_POLICY = "store_policy"
    GENERAL_CONVERSATION = "general_conversation"


@dataclass
class ProductSearchIntent:
    """Structured catalog search parameters extracted from user text."""

    query_text: Optional[str] = None
    query_terms: List[str] = field(default_factory=list)
    category_name: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    max_price_inclusive: bool = True
    exact_price: Optional[float] = None
    exclude_product_ids: List[int] = field(default_factory=list)
    on_sale_only: bool = False
    in_stock_only: bool = False

    def is_searchable(self) -> bool:
        return bool(
            (self.query_text and self.query_text.strip())
            or self.query_terms
            or self.category_name
            or self.min_price is not None
            or self.max_price is not None
            or self.on_sale_only
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "ProductSearchIntent":
        if not data:
            return cls()
        return cls(
            query_text=data.get("query_text"),
            query_terms=list(data.get("query_terms") or []),
            category_name=data.get("category_name"),
            min_price=data.get("min_price"),
            max_price=data.get("max_price"),
            max_price_inclusive=bool(data.get("max_price_inclusive", True)),
            exact_price=data.get("exact_price"),
            exclude_product_ids=list(data.get("exclude_product_ids") or []),
            on_sale_only=bool(data.get("on_sale_only")),
            in_stock_only=bool(data.get("in_stock_only")),
        )


@dataclass
class SearchSessionContext:
    last_message: Optional[str] = None
    last_intent_type: Optional[str] = None
    last_search_intent: Optional[ProductSearchIntent] = None
    last_result_ids: List[int] = field(default_factory=list)
    last_result_prices: List[float] = field(default_factory=list)

    @classmethod
    def from_session(cls, session: Dict[str, Any]) -> "SearchSessionContext":
        return cls(
            last_message=session.get("last_message"),
            last_intent_type=session.get("last_intent_type"),
            last_search_intent=ProductSearchIntent.from_dict(session.get("last_search_intent")),
            last_result_ids=list(session.get("last_result_ids") or []),
            last_result_prices=list(session.get("last_result_prices") or []),
        )

    def apply_to_session(self, session: Dict[str, Any]) -> None:
        session["last_intent_type"] = self.last_intent_type
        session["last_search_intent"] = (
            self.last_search_intent.to_dict() if self.last_search_intent else {}
        )
        session["last_result_ids"] = self.last_result_ids
        session["last_result_prices"] = self.last_result_prices


@dataclass
class RankedProduct:
    product: Any
    score: float

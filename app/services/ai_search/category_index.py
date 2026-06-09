from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app import models

_CACHE_TTL_SECONDS = 300.0
_category_cache: Dict[str, Tuple[float, List["CategoryAlias"]]] = {}


@dataclass(frozen=True)
class CategoryAlias:
    canonical_name: str
    alias: str
    alias_lower: str


def _normalize_for_match(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _alias_in_message(alias: str, message: str) -> bool:
    """Match category alias as a substring (works for Arabic/French) or whole word (Latin)."""
    alias_norm = _normalize_for_match(alias)
    message_norm = _normalize_for_match(message)
    if not alias_norm or alias_norm not in message_norm:
        return False
    if re.search(r"[^\x00-\x7F]", alias_norm):
        return True
    pattern = rf"(?<!\w){re.escape(alias_norm)}(?!\w)"
    return bool(re.search(pattern, message_norm))


def load_category_aliases(db: Session, cache_key: str = "default") -> List[CategoryAlias]:
    now = time.monotonic()
    cached = _category_cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    categories = db.query(models.DBCategory).order_by(models.DBCategory.name.asc()).all()
    aliases: List[CategoryAlias] = []
    seen: set[Tuple[str, str]] = set()

    for category in categories:
        for field in (category.name, category.name_ar, category.name_fr):
            if not field:
                continue
            cleaned = field.strip()
            if len(cleaned) < 2:
                continue
            key = (category.name, cleaned.lower())
            if key in seen:
                continue
            seen.add(key)
            aliases.append(
                CategoryAlias(
                    canonical_name=category.name,
                    alias=cleaned,
                    alias_lower=cleaned.lower(),
                )
            )

    # Longer aliases first so "dining table" wins over "table".
    aliases.sort(key=lambda item: len(item.alias), reverse=True)
    _category_cache[cache_key] = (now, aliases)
    return aliases


def match_category(message: str, aliases: List[CategoryAlias]) -> Optional[str]:
    for item in aliases:
        if _alias_in_message(item.alias, message):
            return item.canonical_name
    return None


def invalidate_category_cache(cache_key: str = "default") -> None:
    _category_cache.pop(cache_key, None)

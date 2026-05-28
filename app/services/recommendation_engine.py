"""
Hybrid recommendations: weighted interaction affinity + content similarity + optional PMI from orders.

Content-based: TF–IDF over category + name + description blended with scaled log(price).
Behavioral: exponentially decayed event weights `{view:1, search:2, wishlist:3, add_to_cart:5, purchase:10}`.
Collaborative-lite: PMI-style lift edges from products bought in the same order.
Empty state: returns no items until the user actually interacts (view / search / wishlist / add_to_cart / purchase).
When the catalog is small or the user has seen every product, falls back to affinity revisit and buy-again picks."""
from __future__ import annotations

import hashlib
import math
import random
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, MutableMapping, Sequence

import numpy as np
from sqlalchemy.orm import Session
from scipy import sparse as sp_sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

from app import models


EVENT_WEIGHTS: dict[str, int] = {
    "view": 1,
    "search": 2,
    "wishlist": 3,
    "add_to_cart": 5,
    "purchase": 10,
}


@dataclass(frozen=True)
class RecommendParams:
    lookback_hours: float
    half_life_hours: float
    max_seeds: int
    neighbors_per_seed: int
    search_query_weight: float
    co_purchase_weight: float
    cold_start_affinity_floor: float
    min_products_for_personalization: int
    # Tie rankings to categories the user actually touched (not search-expanded SKUs alone).
    coherent_top_touch_categories: int = 2
    coherent_in_category_multiplier: float = 1.48
    coherent_out_category_multiplier: float = 0.62
    coherent_min_touch_seeds: int = 2


REALTIME_PARAMS = RecommendParams(
    lookback_hours=72.0,
    half_life_hours=18.0,
    max_seeds=12,
    neighbors_per_seed=25,
    search_query_weight=4.0,
    co_purchase_weight=3.5,
    cold_start_affinity_floor=15.0,
    min_products_for_personalization=2,
    coherent_top_touch_categories=1,
    coherent_min_touch_seeds=1,
)

BATCH_PARAMS = RecommendParams(
    lookback_hours=24.0 * 365.0,
    half_life_hours=24.0 * 21.0,
    max_seeds=24,
    neighbors_per_seed=40,
    search_query_weight=5.0,
    co_purchase_weight=6.0,
    cold_start_affinity_floor=25.0,
    min_products_for_personalization=2,
    coherent_top_touch_categories=2,
    coherent_min_touch_seeds=2,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _age_hours(reference: datetime, ts: datetime) -> float:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0.0, (reference - ts).total_seconds() / 3600.0)


def _decayed_weight(weight: float, age_h: float, half_life_h: float) -> float:
    if half_life_h <= 0:
        return weight
    return weight * math.exp(-math.log(2.0) * age_h / half_life_h)


def _catalog_signature(products: Sequence[models.DBProduct]) -> str:
    blob = "".join(f"{p.id}|{float(p.price)}|{p.category_name}|{p.name}|{p.description}" for p in products)
    return hashlib.sha256(blob.encode("utf-8", errors="ignore")).hexdigest()


class _CatalogIndex:
    def __init__(self, products: Sequence[models.DBProduct]) -> None:
        self.products = products
        self.ids: list[int] = [p.id for p in products]
        self.idx_of: dict[int, int] = {pid: i for i, pid in enumerate(self.ids)}
        texts: list[str] = []
        raw_prices: list[list[float]] = []
        for p in products:
            texts.append(f"{p.category_name} {p.name}\n{p.description}")
            raw_prices.append([float(np.log1p(max(float(p.price), 1e-6)))])
        self.vectorizer = TfidfVectorizer(
            max_features=8000,
            ngram_range=(1, 2),
            min_df=1,
            strip_accents="unicode",
            sublinear_tf=True,
        )
        X_text = self.vectorizer.fit_transform(texts)
        scaler = MinMaxScaler()
        X_price = scaler.fit_transform(np.asarray(raw_prices, dtype=float))
        X_price_csr = sp_sparse.csr_matrix(X_price) * 0.35
        self.X = sp_sparse.hstack([X_text * 0.82, X_price_csr]).tocsr()
        self.signature = _catalog_signature(products)


_INDEX_CACHE: dict[str, tuple[_CatalogIndex, float]] = {}
INDEX_TTL_SEC = float(__import__("os").getenv("RECOMMENDATIONS_INDEX_TTL_SEC", "600"))


def get_catalog_index(db: Session) -> _CatalogIndex:
    products = db.query(models.DBProduct).order_by(models.DBProduct.id).all()
    sig = _catalog_signature(products)
    now = time.time()
    cached = _INDEX_CACHE.get(sig)
    if cached is not None and now - cached[1] < INDEX_TTL_SEC:
        return cached[0]
    idx = _CatalogIndex(products)
    _INDEX_CACHE.clear()
    _INDEX_CACHE[sig] = (idx, now)
    return idx


def _co_purchase_neighbor_scores(db: Session) -> Mapping[int, dict[int, float]]:
    neighbors: dict[int, dict[int, float]] = defaultdict(dict)
    orders_rows = db.query(models.DBOrderItem.order_id, models.DBOrderItem.product_id).all()
    if not orders_rows:
        return neighbors
    orders_map: MutableMapping[int, list[int]] = defaultdict(list)
    for oid, pid in orders_rows:
        orders_map[int(oid)].append(int(pid))
    product_totals: MutableMapping[int, int] = defaultdict(int)
    pair_counts: MutableMapping[tuple[int, int], int] = defaultdict(int)
    n_orders = max(1, len(orders_map))
    eps = 1e-9
    for _oid, plist in orders_map.items():
        uniq = sorted(set(plist))
        for p in uniq:
            product_totals[p] += 1
        for i in range(len(uniq)):
            a = uniq[i]
            for j in range(len(uniq)):
                if i == j:
                    continue
                b = uniq[j]
                pair_counts[(a, b)] += 1
    for (a, b), c_ab in pair_counts.items():
        lift = math.log(((c_ab + eps) * n_orders) / ((product_totals[a] + eps) * (product_totals[b] + eps)) + eps)
        neighbors[a][b] = float(max(0.0, lift))
    return neighbors


def _global_product_affinity(db: Session, cutoff: datetime, half_life_h: float) -> Mapping[int, float]:
    trending: MutableMapping[int, float] = defaultdict(float)
    reference = _utcnow()
    rows = (
        db.query(models.DBUserInteraction)
        .filter(models.DBUserInteraction.created_at >= cutoff)
        .filter(models.DBUserInteraction.product_id.isnot(None))
        .all()
    )
    for r in rows:
        pid = int(r.product_id)  # type: ignore[arg-type]
        ew = EVENT_WEIGHTS.get(str(r.event_type), 0)
        if ew == 0:
            continue
        trending[pid] += _decayed_weight(float(ew), _age_hours(reference, r.created_at), half_life_h)
    return trending


def _scores_from_search_queries(
    index: _CatalogIndex,
    rows: Iterable[models.DBUserInteraction],
    reference: datetime,
    params: RecommendParams,
) -> MutableMapping[int, float]:
    out: MutableMapping[int, float] = defaultdict(float)
    for row in rows:
        if str(row.event_type) != models.InteractionEventType.SEARCH or not row.query_text:
            continue
        q_raw = index.vectorizer.transform([row.query_text.strip()])
        pad_cols = index.X.shape[1] - q_raw.shape[1]
        if pad_cols < 0:
            continue
        q_pad = sp_sparse.csr_matrix((1, pad_cols))
        qsparse = sp_sparse.hstack([q_raw * 0.82, q_pad]).tocsr()
        sims = cosine_similarity(qsparse, index.X, dense_output=False).toarray().flatten()
        k = params.neighbors_per_seed
        base = EVENT_WEIGHTS["search"]
        contrib = _decayed_weight(float(base), _age_hours(reference, row.created_at), params.half_life_hours)
        kk = max(1, min(k * 4, len(sims)))
        top_idx = np.argpartition(-sims, kk - 1)[:kk]
        for ti in top_idx:
            sim = float(sims[int(ti)])
            if sim <= 0:
                continue
            pid = index.ids[int(ti)]
            out[pid] += sim * contrib * params.search_query_weight
    return out


def _user_product_affinity(
    interactions: Iterable[models.DBUserInteraction],
    reference: datetime,
    params: RecommendParams,
) -> Mapping[int, float]:
    aff: MutableMapping[int, float] = defaultdict(float)
    for row in interactions:
        if row.product_id is None:
            continue
        ew = EVENT_WEIGHTS.get(str(row.event_type), 0)
        if ew == 0:
            continue
        w = _decayed_weight(float(ew), _age_hours(reference, row.created_at), params.half_life_hours)
        aff[int(row.product_id)] += w
    return aff


def _top_similar_products(index: _CatalogIndex, product_id: int, k: int) -> list[tuple[int, float]]:
    row_i = index.idx_of.get(product_id)
    if row_i is None:
        return []
    sims = cosine_similarity(index.X[row_i : row_i + 1], index.X, dense_output=False).toarray().flatten()
    sims[row_i] = -1.0
    kk = max(1, min(k * 2 + 35, len(sims)))
    cand = np.argpartition(-sims, kk - 1)[:kk]
    out: list[tuple[int, float]] = []
    for ti in cand:
        if int(ti) == row_i:
            continue
        s = float(sims[int(ti)])
        if s <= 0:
            continue
        out.append((index.ids[int(ti)], s))
    out.sort(key=lambda x: -x[1])
    return out[:k]


def _product_category_map(db: Session, product_ids: Iterable[int]) -> dict[int, str]:
    ids_u = sorted({int(i) for i in product_ids})
    if not ids_u:
        return {}
    out: dict[int, str] = {}
    rows = (
        db.query(models.DBProduct.id, models.DBProduct.category_name)
        .filter(models.DBProduct.id.in_(ids_u))
        .all()
    )
    for r in rows:
        out[int(r.id)] = (r.category_name or "general")
    return out


def _preferred_touch_categories(
    touch_only: Mapping[int, float],
    cat_by_pid: Mapping[int, str],
    top_n: int,
) -> set[str]:
    if top_n <= 0 or not touch_only:
        return set()
    sums: MutableMapping[str, float] = defaultdict(float)
    for pid, w in touch_only.items():
        c = cat_by_pid.get(int(pid))
        if not c:
            continue
        sums[c] += float(w)
    ordered = sorted(sums.keys(), key=lambda c: (-sums[c], c))
    return set(ordered[:top_n])


def _coherent_seed_ids(
    seeds_sorted_full: list[int],
    cat_by_pid: Mapping[int, str],
    preferred_categories: set[str],
    max_seeds: int,
    min_coherent: int,
) -> list[int]:
    """Take seeds from the user's strongest touched categories first; otherwise fall back."""
    if not preferred_categories:
        return seeds_sorted_full[:max_seeds]
    prioritized = [s for s in seeds_sorted_full if cat_by_pid.get(int(s), "") in preferred_categories]
    merged: list[int] = []
    seen: set[int] = set()
    for s in prioritized:
        if s not in seen and len(merged) < max_seeds:
            merged.append(s)
            seen.add(s)
    if len(merged) >= min_coherent or (min_coherent <= 1 and len(merged) >= 1):
        return merged[:max_seeds]
    out: list[int] = []
    seen.clear()
    for s in seeds_sorted_full:
        if s not in seen and len(out) < max_seeds:
            out.append(s)
            seen.add(s)
    return out


def _score_category_adjust(
    product_id: int,
    score: float,
    cat_by_pid: Mapping[int, str],
    preferred: set[str],
    in_mult: float,
    out_mult: float,
) -> float:
    if not preferred:
        return score
    c = cat_by_pid.get(int(product_id), "") or ""
    return score * (in_mult if c in preferred else out_mult)


def _cold_start_fallback(
    db: Session,
    exclude: set[int],
    limit: int,
    *,
    user_id: int | None = None,
    prefer_categories: set[str] | None = None,
) -> list[tuple[int, float, list[str]]]:
    cutoff = datetime.fromtimestamp(_utcnow().timestamp() - 90 * 86400.0, tz=timezone.utc)
    trending_global = dict(_global_product_affinity(db, cutoff, BATCH_PARAMS.half_life_hours))
    buckets: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for pid, sc in trending_global.items():
        if pid in exclude:
            continue
        prod = db.query(models.DBProduct).filter(models.DBProduct.id == pid).first()
        bucket = prod.category_name if prod else "general"
        buckets[bucket].append((pid, sc))
    picked: list[tuple[int, float, list[str]]] = []
    bucket_names = sorted(buckets.keys())
    if prefer_categories and buckets:
        bucket_names = sorted(
            buckets.keys(),
            key=lambda b: (
                0 if b in prefer_categories else 1,
                -max((sc for _, sc in buckets[b]), default=0.0),
                b,
            ),
        )
    while len(picked) < limit:
        progressed = False
        for bucket in bucket_names:
            if len(picked) >= limit:
                break
            lst = sorted(buckets[bucket], key=lambda x: -x[1])
            while lst:
                pid, score = lst.pop(0)
                if pid not in exclude and pid not in {p for p, _, _ in picked}:
                    picked.append((pid, score, ["cold_global_trending", bucket]))
                    progressed = True
                    break
            if len(picked) >= limit:
                break
        if not progressed:
            break
    if len(picked) >= limit:
        return picked[:limit]

    rows = db.query(models.DBProduct).order_by(models.DBProduct.id.asc()).limit(min(600, max(limit * 40, 120))).all()
    if not rows:
        return picked[:limit]
    seed = int.from_bytes(
        hashlib.sha256(str(user_id or 0).encode("utf-8")).digest()[:8],
        "big",
    )

    pref_rows: list[models.DBProduct] = []
    other_rows: list[models.DBProduct] = []
    if prefer_categories:
        for p in rows:
            cn = (getattr(p, "category_name", None) or "").strip() or "general"
            (pref_rows if cn in prefer_categories else other_rows).append(p)
        rng = random.Random(seed)
        rng.shuffle(pref_rows)
        rng2 = random.Random(seed ^ 0x9E3779B9)
        rng2.shuffle(other_rows)
        ordered_rows = pref_rows + other_rows
    else:
        order = list(range(len(rows)))
        random.Random(seed).shuffle(order)
        ordered_rows = [rows[i] for i in order]

    seen_picked = {p for p, _, _ in picked}
    for p in ordered_rows:
        if len(picked) >= limit:
            break
        pid = p.id
        if pid in exclude or pid in seen_picked:
            continue
        seen_picked.add(pid)
        bucket = getattr(p, "category_name", "general") or "general"
        picked.append((pid, 0.05, ["cold_catalog_sample", bucket]))
    return picked[:limit]


def _affinity_revisit_fallback(
    affinity: Mapping[int, float],
    exclude: set[int],
    limit: int,
) -> list[tuple[int, float, list[str]]]:
    """When every unseen neighbor is exhausted, resurface engaged products (except purchases)."""
    out: list[tuple[int, float, list[str]]] = []
    for pid, aff in sorted(affinity.items(), key=lambda kv: (-float(kv[1]), int(kv[0]))):
        if int(pid) in exclude:
            continue
        out.append((int(pid), float(aff), ["affinity_revisit"]))
        if len(out) >= limit:
            break
    if out:
        return out

    # User already purchased or exhausted every candidate — allow buy-again picks.
    for pid, aff in sorted(affinity.items(), key=lambda kv: (-float(kv[1]), int(kv[0]))):
        out.append((int(pid), float(aff) * 0.35, ["buy_again"]))
        if len(out) >= limit:
            break
    return out


def recommend_hybrid_for_user(
    db: Session,
    user_id: int,
    limit: int,
    params: RecommendParams,
) -> tuple[list[tuple[int, float, list[str]]], dict[str, Any]]:
    reference = _utcnow()
    since = datetime.fromtimestamp(reference.timestamp() - params.lookback_hours * 3600.0, tz=timezone.utc)
    interactions = (
        db.query(models.DBUserInteraction)
        .filter(models.DBUserInteraction.user_id == user_id)
        .filter(models.DBUserInteraction.created_at >= since)
        .order_by(models.DBUserInteraction.created_at.desc())
        .all()
    )

    if not interactions:
        # Strict policy: no recommendations until the user actually browses, searches,
        # adds to cart/wishlist, or purchases. No trending / cold-start fill.
        return [], {
            "cold_start": False,
            "total_behavioral_affinity_touch": 0.0,
            "interaction_rows": 0,
            "distinct_touched_products": 0,
            "strategy": "empty_no_interactions",
        }

    exclude: set[int] = set()
    for r in interactions:
        if not r.product_id:
            continue
        if str(r.event_type) == models.InteractionEventType.PURCHASE:
            exclude.add(int(r.product_id))

    index = get_catalog_index(db)
    touch_only_affinity: dict[int, float] = dict(_user_product_affinity(interactions, reference, params))
    search_affinity_updates = dict(_scores_from_search_queries(index, interactions, reference, params))
    affinity: dict[int, float] = {**touch_only_affinity}
    for pid, scr in search_affinity_updates.items():
        affinity[pid] = affinity.get(pid, 0.0) + float(scr)

    if not affinity:
        # Interactions exist but produced no signal (e.g. only blank searches).
        return [], {
            "cold_start": False,
            "total_behavioral_affinity_touch": 0.0,
            "interaction_rows": len(interactions),
            "distinct_touched_products": 0,
            "strategy": "empty_no_signal",
        }

    co_neighbors = _co_purchase_neighbor_scores(db)

    touch_cat_map = _product_category_map(db, touch_only_affinity.keys())
    preferred_touch_cats = _preferred_touch_categories(
        touch_only_affinity,
        touch_cat_map,
        params.coherent_top_touch_categories,
    )

    seeds_sorted_full = sorted(affinity.keys(), key=lambda k: affinity.get(k, 0.0), reverse=True)
    seed_cat_scan = list(dict.fromkeys(seeds_sorted_full[: params.max_seeds + 60]))
    full_seed_cat = dict(touch_cat_map)
    full_seed_cat.update(_product_category_map(db, [x for x in seed_cat_scan if x not in full_seed_cat]))

    seeds = _coherent_seed_ids(
        seeds_sorted_full,
        full_seed_cat,
        preferred_touch_cats,
        params.max_seeds,
        params.coherent_min_touch_seeds,
    )

    aggregated: MutableMapping[int, MutableMapping[str, Any]] = defaultdict(lambda: {"score": 0.0, "sources": set()})

    # Surface search-matched products themselves so a fresh search alone produces results,
    # not just neighbors of the matched products.
    for pid, scr in search_affinity_updates.items():
        if pid in exclude or pid in touch_only_affinity:
            continue
        if scr <= 0:
            continue
        item = aggregated[pid]
        item["score"] += float(scr)  # type: ignore[operator]
        item["sources"].add("search_match")  # type: ignore[union-attr]

    for seed_pid in seeds:
        seed_pull = affinity.get(seed_pid, 0.0)
        for neighbor_pid, sim in _top_similar_products(index, seed_pid, params.neighbors_per_seed):
            if neighbor_pid in exclude or neighbor_pid == seed_pid:
                continue
            if neighbor_pid in touch_only_affinity:
                continue
            bump = seed_pull * sim
            item = aggregated[neighbor_pid]
            item["score"] += bump  # type: ignore[operator]
            item["sources"].add(f"content_neighbor_from:{seed_pid}")  # type: ignore[union-attr]
        for nb, co_scr in co_neighbors.get(seed_pid, {}).items():
            if nb in exclude or nb in touch_only_affinity:
                continue
            bump = seed_pull * co_scr * params.co_purchase_weight
            aggregated[nb]["score"] += bump  # type: ignore[operator]
            aggregated[nb]["sources"].add(f"co_purchase_with:{seed_pid}")  # type: ignore[union-attr]

    ranking = sorted(aggregated.items(), key=lambda kv: -float(kv[1]["score"]))  # type: ignore[arg-type]

    cand_cat_map: dict[int, str] = dict(full_seed_cat)
    cand_cat_map.update(_product_category_map(db, list(touch_only_affinity.keys())))
    top_snip_pids = [pid for pid, _ in ranking[: max(limit * 50, 100)]]
    cand_cat_map.update(_product_category_map(db, [p for p in top_snip_pids if p not in cand_cat_map]))

    scored_candidates: list[tuple[int, float, list[str]]] = []
    for pid, pay in ranking:
        if pid in touch_only_affinity:
            continue
        raw = float(pay["score"])  # type: ignore[arg-type]
        if raw <= 0:
            continue
        sc = _score_category_adjust(
            pid,
            raw,
            cand_cat_map,
            preferred_touch_cats,
            params.coherent_in_category_multiplier,
            params.coherent_out_category_multiplier,
        )
        src = sorted(pay["sources"])  # type: ignore[arg-type]
        scored_candidates.append((pid, sc, src))

    scored_candidates.sort(key=lambda t: (-t[1], t[0]))
    hydrated = scored_candidates[:limit]
    strategy = "hybrid_content_co_purchase"

    if not hydrated:
        hydrated = _affinity_revisit_fallback(affinity, exclude, limit)
        if hydrated:
            strategy = "affinity_revisit_fallback"

    if not hydrated:
        hydrated = _cold_start_fallback(
            db,
            exclude,
            limit,
            user_id=user_id,
            prefer_categories=preferred_touch_cats,
        )
        if hydrated:
            strategy = "cold_start_fallback"

    meta = {
        "cold_start": strategy == "cold_start_fallback",
        "total_behavioral_affinity_touch": float(sum(touch_only_affinity.values())),
        "interaction_rows": len(interactions),
        "distinct_touched_products": len(touch_only_affinity),
        "preferred_touch_categories": sorted(preferred_touch_cats),
        "coherent_seeds_used": seeds,
        "strategy": strategy,
    }
    return hydrated[:limit], meta


def recompute_batch_for_users(
    db: Session,
    user_ids: Iterable[int],
    *,
    params: RecommendParams = BATCH_PARAMS,
    limit_default: int = 20,
) -> int:
    written = 0
    reference = _utcnow()
    for uid in user_ids:
        ranked, meta = recommend_hybrid_for_user(db, int(uid), limit_default, params)
        payload: dict[str, Any] = {
            "items": [
                {"product_id": pid, "score": float(score), "sources": sources} for pid, score, sources in ranked
            ],
            "computed_at": reference.isoformat(),
            "meta": meta,
        }
        row = db.query(models.DBRecommendationBatchCache).filter_by(user_id=int(uid)).first()
        if row:
            row.payload = payload
            row.computed_at = reference
        else:
            db.add(models.DBRecommendationBatchCache(user_id=int(uid), payload=payload, computed_at=reference))
        written += 1
    db.commit()
    return written

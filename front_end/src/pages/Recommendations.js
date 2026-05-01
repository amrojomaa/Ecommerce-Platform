import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaSync, FaUndo } from 'react-icons/fa';

import API_BASE_URL from '../config/api';
import { formatPrice } from '../utils/helpers';
import { useConfirm } from '../hooks/useConfirm';
import {
  fetchBatchRecommendations,
  fetchRealtimeRecommendations,
  resetRecommendationProfile,
} from '../services/recommendations';

import '../styles/pages/Recommendations.css';

const imgUrl = (path) => {
  if (!path) return `${API_BASE_URL}/images/placeholder.jpg`;
  const p = String(path).replace(/^\//, '');
  return `${API_BASE_URL}/${p}`;
};

const Recommendations = () => {
  const confirm = useConfirm();
  const [realtime, setRealtime] = useState([]);
  const [batch, setBatch] = useState([]);
  const [loadingRt, setLoadingRt] = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [refreshingBatch, setRefreshingBatch] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [historyJustCleared, setHistoryJustCleared] = useState(false);

  const loadRealtime = useCallback(async () => {
    setLoadingRt(true);
    try {
      const { data } = await fetchRealtimeRecommendations(12);
      setRealtime(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.message || 'Could not load realtime recommendations';
      toast.error(msg);
      setRealtime([]);
    } finally {
      setLoadingRt(false);
    }
  }, []);

  const loadBatch = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshingBatch(true);
    else setLoadingBatch(true);
    try {
      const { data } = await fetchBatchRecommendations(15, forceRefresh);
      setBatch(Array.isArray(data) ? data : []);
      if (forceRefresh) toast.success('Batch recommendations refreshed');
    } catch (err) {
      const msg = err?.message || 'Could not load batch recommendations';
      toast.error(msg);
      setBatch([]);
    } finally {
      setLoadingBatch(false);
      setRefreshingBatch(false);
    }
  }, []);

  useEffect(() => {
    loadRealtime();
    loadBatch(false);
  }, [loadRealtime, loadBatch]);

  const handleResetRecommendations = async () => {
    const ok = await confirm({
      title: 'Reset recommendations?',
      message:
        'This clears your saved product views, searches, and other signals used only for “For you” recommendations. Your cart, wishlist, and orders are not changed.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
    });
    if (!ok) return;

    setResetting(true);
    try {
      const { data } = await resetRecommendationProfile();
      const n = typeof data?.interactions_deleted === 'number' ? data.interactions_deleted : null;
      setRealtime([]);
      setBatch([]);
      setHistoryJustCleared(true);
      toast.success(
        n !== null && n >= 0
          ? `Cleared ${n} saved browsing signal${n === 1 ? '' : 's'}. Recommendations will stay empty until you browse, search, or add to cart again.`
          : 'Recommendation history cleared. Recommendations will stay empty until you browse, search, or add to cart again.'
      );
    } catch (err) {
      toast.error(err?.message || 'Could not reset recommendations');
    } finally {
      setResetting(false);
    }
  };

  const renderCard = (entry, i) => {
    const p = entry.product;
    if (!p) return null;
    const thumb = p.images && p.images.length ? imgUrl(p.images[0]) : imgUrl(null);
    const encName = encodeURIComponent(p.name);
    return (
      <motion.article
        key={`${p.id}-${i}`}
        className="reco-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.03 }}
      >
        <Link to={`/products/${encName}`} className="reco-card-link">
          <div className="reco-card-image-wrap">
            <img src={thumb} alt="" className="reco-card-img" onError={(e) => { e.currentTarget.src = imgUrl(null); }} />
          </div>
          <div className="reco-card-body">
            <h3 className="reco-card-title">{p.name}</h3>
            <p className="reco-card-category">{p.category_name}</p>
            <p className="reco-card-price">
              {formatPrice(p.discounted_price ?? p.price)}
            </p>
            <p className="reco-card-meta">
              score {Number(entry.score).toFixed(2)}
              {entry.sources?.length ? ` · ${entry.sources.slice(0, 2).join(', ')}` : ''}
            </p>
          </div>
        </Link>
      </motion.article>
    );
  };

  return (
    <div className="recommendations-page">
      <div className="recommendations-inner">
        <header className="recommendations-header">
          <div className="recommendations-title-row">
            <div>
              <h1>Recommended for you</h1>
              <p className="recommendations-sub">
                Uses your views, searches, wishlist, cart, and purchases. Log some activity, then refresh.
              </p>
            </div>
            <button
              type="button"
              className="reco-reset-btn"
              onClick={handleResetRecommendations}
              disabled={resetting}
              title="Clear recommendation history (does not empty cart or wishlist)"
            >
              <FaUndo /> {resetting ? 'Resetting…' : 'Reset recommendations'}
            </button>
          </div>
        </header>

        {historyJustCleared && (
          <p className="reco-cleared-banner" role="status">
            Your personalization log was cleared on the server. Both lists will stay <strong>empty</strong>—even after a refresh—until you <strong>view a product</strong>, <strong>search</strong>, or <strong>add something to the cart / wishlist</strong>.
          </p>
        )}

        <section className="reco-section">
          <div className="reco-section-head">
            <h2>Realtime</h2>
            <button type="button" className="reco-refresh-btn" onClick={() => loadRealtime()} disabled={loadingRt}>
              <FaSync className={loadingRt ? 'spin' : ''} /> Refresh
            </button>
          </div>
          {loadingRt ? (
            <p className="reco-loading">Loading…</p>
          ) : realtime.length === 0 ? (
            <p className="reco-empty">
              Nothing yet — view a product, search, or add to cart / wishlist while logged in, then press Refresh.
            </p>
          ) : (
            <div className="reco-grid">{realtime.map((e, i) => renderCard(e, i))}</div>
          )}
        </section>

        <section className="reco-section">
          <div className="reco-section-head">
            <h2>Batch (cached)</h2>
            <div className="reco-batch-actions">
              <button type="button" className="reco-refresh-btn" onClick={() => loadBatch(false)} disabled={loadingBatch || refreshingBatch}>
                <FaSync className={loadingBatch ? 'spin' : ''} /> Load cache
              </button>
              <button type="button" className="reco-refresh-btn primary" onClick={() => loadBatch(true)} disabled={loadingBatch || refreshingBatch}>
                <FaSync className={refreshingBatch ? 'spin' : ''} /> Recompute now
              </button>
            </div>
          </div>
          {loadingBatch && batch.length === 0 ? (
            <p className="reco-loading">Loading…</p>
          ) : batch.length === 0 ? (
            <p className="reco-empty">
              No batch results yet — view, search, or add to cart / wishlist first, then press Load cache or Recompute now.
            </p>
          ) : (
            <div className="reco-grid">{batch.map((e, i) => renderCard(e, i))}</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Recommendations;

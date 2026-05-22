import { tUi } from "../i18n/uiText";
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaSync, FaUndo } from 'react-icons/fa';

import API_BASE_URL from '../config/api';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import {
  fetchBatchRecommendations,
  fetchRealtimeRecommendations,
  resetRecommendationProfile } from
'../services/recommendations';

import '../styles/pages/Recommendations.css';
import PageHeader from '../components/PageHeader';

const imgUrl = (path) => {
  if (!path) return `${API_BASE_URL}/images/placeholder.jpg`;
  const p = String(path).replace(/^\//, '');
  return `${API_BASE_URL}/${p}`;
};

const Recommendations = () => {
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
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
    if (forceRefresh) setRefreshingBatch(true);else
    setLoadingBatch(true);
    try {
      const { data } = await fetchBatchRecommendations(15, forceRefresh);
      setBatch(Array.isArray(data) ? data : []);
      if (forceRefresh) toast.success(tUi("ui.pages.recommendations.batchRecommendationsRefreshed_3c588c1cd7"));
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
      title: tUi("ui.pages.recommendations.resetRecommendations_849eafbc0e"),
      message: tUi("ui.pages.recommendations.thisClearsYourSavedProduct_09c55cba3d"),

      confirmText: tUi("ui.pages.recommendations.reset_fa323b2d19"),
      cancelText: tUi("ui.pages.recommendations.cancel_5a0d97a8e1")
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
        n !== null && n >= 0 ?
        `Cleared ${n} saved browsing signal${n === 1 ? '' : 's'}. Recommendations will stay empty until you browse, search, or add to cart again.` :
        'Recommendation history cleared. Recommendations will stay empty until you browse, search, or add to cart again.'
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
        transition={{ delay: i * 0.03 }}>
        
        <Link to={`/products/${encName}`} className="reco-card-link">
          <div className="reco-card-image-wrap">
            <img src={thumb} alt="" className="reco-card-img" onError={(e) => {e.currentTarget.src = imgUrl(null);}} />
          </div>
          <div className="reco-card-body">
            <h3 className="reco-card-title">{p.name}</h3>
            <p className="reco-card-category">{p.category_name}</p>
            <p className="reco-card-price">
              {formatCurrency(p.discounted_price ?? p.price)}
            </p>
            <p className="reco-card-meta">{tUi("ui.pages.recommendations.score_8560416b4d")}
              {Number(entry.score).toFixed(2)}
              {entry.sources?.length ? tUi("ui.pages.recommendations.value_01385437d2", { value0: entry.sources.slice(0, 2).join(', ') }) : ''}
            </p>
          </div>
        </Link>
      </motion.article>);

  };

  return (
    <div className="page-shell recommendations-page">
      <div className="recommendations-inner">
        <PageHeader
          kicker={tUi("ui.pages.recommendations.recommendedForYou_33db7a2db1")}
          title={tUi("ui.pages.recommendations.recommendedForYou_33db7a2db1")}
          subtitle={tUi("ui.pages.recommendations.usesYourViewsSearchesWishlist_7518b14b04")}
          actions={
            <button
              type="button"
              className="reco-reset-btn page-btn-danger reco-reset-btn-ds"
              onClick={handleResetRecommendations}
              disabled={resetting}
              title={tUi("ui.pages.recommendations.clearRecommendationHistoryDoesNot_d511c61ddd")}>
              
              <FaUndo /> {resetting ? tUi("ui.pages.recommendations.resetting_c7defdfad7") : tUi("ui.pages.recommendations.resetRecommendations_10844cd05c")}
            </button>
          }
          animate={false}
        />

        {historyJustCleared &&
        <p className="reco-cleared-banner" role="status">{tUi("ui.pages.recommendations.yourPersonalizationLogWasCleared_99b6775cce")}
          <strong>{tUi("ui.pages.recommendations.empty_e9fa2b3619")}</strong>{tUi("ui.pages.recommendations.evenAfterARefreshUntil_393b4c5366")}<strong>{tUi("ui.pages.recommendations.viewAProduct_45cf624682")}</strong>, <strong>{tUi("ui.pages.recommendations.search_11d7340d13")}</strong>{tUi("ui.pages.recommendations.or_11ea543640")}<strong>{tUi("ui.pages.recommendations.addSomethingToTheCart_2fde947f12")}</strong>.
          </p>
        }

        <section className="reco-section">
          <div className="reco-section-head">
            <h2 className="page-section-title reco-section-title">{tUi("ui.pages.recommendations.realtime_37d7df59d7")}</h2>
            <button type="button" className="reco-refresh-btn page-btn-secondary reco-refresh-btn--sm" onClick={() => loadRealtime()} disabled={loadingRt}>
              <FaSync className={loadingRt ? "spin" : ''} />{tUi("ui.pages.recommendations.refresh_ba2298225f")}
            </button>
          </div>
          {loadingRt ?
          <div className="page-loading reco-section-loading">{tUi("ui.pages.recommendations.loading_c951e2c5a2")}</div> :
          realtime.length === 0 ?
          <div className="page-empty reco-empty-state">
            <p>{tUi("ui.pages.recommendations.nothingYetViewAProduct_7f253a9a74")}</p>
          </div> :

          <div className="reco-grid">{realtime.map((e, i) => renderCard(e, i))}</div>
          }
        </section>

        <section className="reco-section">
          <div className="reco-section-head">
            <h2 className="page-section-title reco-section-title">{tUi("ui.pages.recommendations.batchCached_5246e3e266")}</h2>
            <div className="reco-batch-actions">
              <button type="button" className="reco-refresh-btn page-btn-secondary reco-refresh-btn--sm" onClick={() => loadBatch(false)} disabled={loadingBatch || refreshingBatch}>
                <FaSync className={loadingBatch ? "spin" : ''} />{tUi("ui.pages.recommendations.loadCache_e03259ab79")}
              </button>
              <button type="button" className="reco-refresh-btn page-btn-primary reco-refresh-btn--sm" onClick={() => loadBatch(true)} disabled={loadingBatch || refreshingBatch}>
                <FaSync className={refreshingBatch ? "spin" : ''} />{tUi("ui.pages.recommendations.recomputeNow_bac7d8c8a7")}
              </button>
            </div>
          </div>
          {loadingBatch && batch.length === 0 ?
          <div className="page-loading reco-section-loading">{tUi("ui.pages.recommendations.loading_c951e2c5a2")}</div> :
          batch.length === 0 ?
          <div className="page-empty reco-empty-state">
            <p>{tUi("ui.pages.recommendations.noBatchResultsYetView_1937d58ec4")}</p>
          </div> :

          <div className="reco-grid">{batch.map((e, i) => renderCard(e, i))}</div>
          }
        </section>
      </div>
    </div>);

};

export default Recommendations;

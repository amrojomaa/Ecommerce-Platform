import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiChevronDown, FiPackage, FiUser } from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime, getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffOrders.css';

const ORDER_STATUS_LABEL_KEYS = {
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
};

const ORDER_FILTERS = ['preparing', 'packed'];

const getOrderStatusLabel = (status) => {
  const normalized = String(status || 'preparing').toLowerCase();
  const key = ORDER_STATUS_LABEL_KEYS[normalized];
  if (key) return tUi(key);
  return normalized.replace(/_/g, ' ');
};

const WarehouseStaffOrders = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const panelKicker = t('ui.sidebar.panel.warehouseStaff');

  const [orders, setOrders] = useState([]);
  const [packedOrders, setPackedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = searchParams.get('filter');
    return ORDER_FILTERS.includes(filter) ? filter : 'preparing';
  });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [verifications, setVerifications] = useState({});
  const [packingOrderId, setPackingOrderId] = useState(null);
  const [issueModal, setIssueModal] = useState(null);
  const [issueForm, setIssueForm] = useState({ issue_type: 'damaged', description: '' });
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const [prepRes, packedRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
      ]);
      setOrders(Array.isArray(prepRes.data) ? prepRes.data : []);
      setPackedOrders(Array.isArray(packedRes.data) ? packedRes.data : []);
    } catch (error) {
      console.error('Error fetching warehouse orders:', error);
      toast.error(tUi('ui.pages.warehouseStaff.warehouseStaffOrders.loadFailed_a1b2c3d4e5'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (ORDER_FILTERS.includes(filter)) {
      setActiveTab(filter);
    } else if (!filter) {
      setActiveTab('preparing');
    }
  }, [searchParams]);

  const handleFilterChange = (value) => {
    setActiveTab(value);
    setExpandedOrder(null);
    if (value === 'preparing') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ filter: value }, { replace: true });
  };

  const loadVerifications = useCallback(async (orderId) => {
    try {
      const res = await http.get(buildUrl(WAREHOUSE_ENDPOINTS.GET_VERIFICATIONS, { order_id: orderId }));
      const vMap = res.data?.verifications || {};
      setVerifications((prev) => ({ ...prev, [orderId]: vMap }));
    } catch (error) {
      console.error('Error fetching verifications:', error);
    }
  }, []);

  const toggleExpand = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!verifications[orderId]) {
      loadVerifications(orderId);
    }
  };

  const handleVerifyItem = async (orderId, orderItemId, verified) => {
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.VERIFY_ITEM, { order_id: orderId }), {
        order_item_id: orderItemId,
        verified,
      });
      setVerifications((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          [orderItemId]: verified ? { verified: true } : { verified: false },
        },
      }));
    } catch (error) {
      const msg = error.response?.data?.detail || tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyFailed_f6g7h8i9j0');
      toast.error(msg);
    }
  };

  const isItemVerified = (orderId, itemId) => verifications[orderId]?.[itemId]?.verified === true;

  const getVerifiedCount = (orderId, items) => {
    if (!items || !verifications[orderId]) return 0;
    return items.filter((item) => verifications[orderId]?.[item.id]?.verified === true).length;
  };

  const handlePackOrder = async (orderId) => {
    setPackingOrderId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.PACK_ORDER, { order_id: orderId }));
      toast.success(tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packSuccess_k1l2m3n4o5'));
      setExpandedOrder(null);
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packFailed_p5q6r7s8t9');
      toast.error(msg);
    } finally {
      setPackingOrderId(null);
    }
  };

  const openIssueModal = (orderId, orderItemId, productName) => {
    setIssueModal({ orderId, orderItemId, productName });
    setIssueForm({ issue_type: 'damaged', description: '' });
  };

  const handleSubmitIssue = async () => {
    if (!issueForm.description.trim()) {
      toast.error(tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescRequired_u1v2w3x4y5'));
      return;
    }
    setSubmittingIssue(true);
    try {
      await http.post(buildUrl(WAREHOUSE_ENDPOINTS.REPORT_ISSUE, { order_id: issueModal.orderId }), {
        order_item_id: issueModal.orderItemId,
        issue_type: issueForm.issue_type,
        description: issueForm.description,
      });
      toast.success(tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueReported_z6a7b8c9d0'));
      setIssueModal(null);
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueFailed_e1f2g3h4i5');
      toast.error(msg);
    } finally {
      setSubmittingIssue(false);
    }
  };

  const formatFilterLabel = (value) => {
    if (value === 'preparing') return tUi('ui.pages.warehouseStaff.warehouseStaffOrders.filterPreparing_j6k7l8m9n0');
    if (value === 'packed') return tUi('ui.pages.warehouseStaff.warehouseStaffOrders.filterPacked_o1p2q3r4s5');
    return value;
  };

  const displayOrders = activeTab === 'preparing' ? orders : packedOrders;
  const emptyMessage =
    activeTab === 'preparing'
      ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.emptyPreparing_t6u7v8w9x0')
      : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.emptyPacked_y1z2a3b4c5');

  const orderCountLabel =
    displayOrders.length === 1
      ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderCountOne_d5e6f7g8h9')
      : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderCountMany_i0j1k2l3m4');

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page wms-page wms-orders-page adm-orders-page">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.title_n5o6p7q8r9')}
        subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.subtitle_s0t1u2v3w4')}
        actions={
          <div className="adm-orders-header-filter wms-orders-header-filter">
            <div className="adm-orders-filter-row">
              <label className="adm-orders-filter-label" htmlFor="wms-orders-status-filter">
                {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.filterByStatus_x5y6z7a8b9')}
              </label>
              <select
                id="wms-orders-status-filter"
                className="adm-orders-select wms-orders-select"
                value={activeTab}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                {ORDER_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {formatFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-orders-header-meta" aria-live="polite">
              <strong>{displayOrders.length}</strong> {orderCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-section wms-orders-section">
        {displayOrders.length === 0 ? (
          <div className="adm-page-empty wms-orders-empty">
            <FiPackage className="wms-orders-empty-icon" aria-hidden />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="wms-orders-data-panel">
            <div className="wms-orders-list">
              <AnimatePresence>
                {displayOrders.map((order, index) => {
                  const orderItems = order.items || order.orderitems || [];
                  const orderStatus = (order.status || 'preparing').toLowerCase();
                  const isExpanded = expandedOrder === order.id;
                  const verifiedCount = getVerifiedCount(order.id, orderItems);
                  const allVerified = orderItems.length > 0 && verifiedCount >= orderItems.length;
                  const hasOpenIssues =
                    Array.isArray(order.warehouse_issues) &&
                    order.warehouse_issues.some((issue) => issue.status === 'open');

                  return (
                    <motion.article
                      key={order.id}
                      className={`wms-order-card${isExpanded ? ' wms-order-card--expanded' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <button
                        type="button"
                        className="wms-order-card-header"
                        onClick={() => toggleExpand(order.id)}
                        aria-expanded={isExpanded}
                      >
                        <div className="wms-order-card-header-left">
                          <span className="wms-order-id">
                            {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderLabel_c0d1e2f3g4', {
                              value0: order.id,
                            })}
                          </span>
                          <span className="wms-order-meta">
                            {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.metaLine_h5i6j7k8l9', {
                              value0: orderItems.length,
                              value1: formatDateTime(order.created_at),
                            })}
                          </span>
                        </div>
                        <div className="wms-order-card-header-right">
                          <span className={`adm-orders-status adm-orders-status--${orderStatus}`}>
                            {getOrderStatusLabel(order.status)}
                          </span>
                          <FiChevronDown className={`wms-order-chevron${isExpanded ? ' wms-order-chevron--open' : ''}`} aria-hidden />
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            className="wms-order-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                          >
                            {order.user && (
                              <div className="wms-customer-panel">
                                <FiUser className="wms-customer-icon" aria-hidden />
                                <div>
                                  <strong>{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.customer_a0b1c2d3e4')}</strong>
                                  <span>
                                    {[order.user.first_name, order.user.last_name].filter(Boolean).join(' ') ||
                                      tUi('ui.pages.warehouseStaff.warehouseStaffOrders.customerNameFallback_a1b2c3d4e5')}
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="wms-verify-section">
                              <div className="wms-verify-section-head">
                                <h3>{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyTitle_m0n1o2p3q4')}</h3>
                                {order.status === 'preparing' && orderItems.length > 0 && (
                                  <span className={`wms-verify-badge${allVerified ? ' wms-verify-badge--complete' : ''}`}>
                                    {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyProgress_g0h1i2j3k4', {
                                      value0: verifiedCount,
                                      value1: orderItems.length,
                                    })}
                                  </span>
                                )}
                              </div>

                              <div className="wms-verify-items">
                                {orderItems.map((item) => {
                                  const verified = isItemVerified(order.id, item.id);
                                  const stockOnHand = item.product?.quantity ?? 0;
                                  const imageSrc = item.product?.images?.[0]
                                    ? getImageUrl(item.product.images[0])
                                    : null;
                                  return (
                                    <div
                                      key={item.id}
                                      className={`wms-verify-item${verified ? ' wms-verify-item--verified' : ''}`}
                                    >
                                      <label className="wms-verify-item-main">
                                        <input
                                          type="checkbox"
                                          className="wms-verify-checkbox"
                                          checked={verified}
                                          onChange={(e) => handleVerifyItem(order.id, item.id, e.target.checked)}
                                          disabled={order.status !== 'preparing'}
                                          aria-label={item.product?.name || 'Product'}
                                        />
                                        {imageSrc ? (
                                          <img
                                            src={imageSrc}
                                            alt={item.product?.name || ''}
                                            className="wms-verify-thumb"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div className="wms-verify-thumb wms-verify-thumb--empty" aria-hidden>
                                            <FiPackage />
                                          </div>
                                        )}
                                        <div className="wms-verify-item-info">
                                          <div className="wms-verify-item-name">
                                            {item.product?.name || tUi('ui.pages.warehouseStaff.warehouseStaffOrders.productFallback_r5s6t7u8v9')}
                                          </div>
                                          <div className="wms-verify-item-meta">
                                            {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.itemStockLine_b6c7d8e9f0', {
                                              value0: item.quantity,
                                              value1: stockOnHand,
                                            })}
                                          </div>
                                        </div>
                                      </label>
                                      {order.status === 'preparing' && (
                                        <button
                                          type="button"
                                          className="wms-report-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openIssueModal(order.id, item.id, item.product?.name);
                                          }}
                                        >
                                          <FiAlertTriangle aria-hidden />
                                          {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.reportIssue_b5c6d7e8f9')}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {order.status === 'preparing' && (
                              <div className="wms-pack-section">
                                {orderItems.length > 0 && (
                                  <div className="wms-verify-progress-bar" role="progressbar" aria-valuenow={verifiedCount} aria-valuemin={0} aria-valuemax={orderItems.length}>
                                    <div
                                      className={`wms-verify-progress-fill${allVerified ? ' wms-verify-progress-fill--complete' : ''}`}
                                      style={{ width: `${Math.round((verifiedCount / orderItems.length) * 100)}%` }}
                                    />
                                  </div>
                                )}
                                <div className="wms-pack-row">
                                  <span className="wms-verify-progress">
                                    {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyProgress_g0h1i2j3k4', {
                                      value0: verifiedCount,
                                      value1: orderItems.length,
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    className="adm-btn-primary wms-pack-btn"
                                    disabled={
                                      verifiedCount < orderItems.length ||
                                      packingOrderId === order.id ||
                                      hasOpenIssues
                                    }
                                    onClick={() => handlePackOrder(order.id)}
                                  >
                                    {packingOrderId === order.id
                                      ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packing_l5m6n7o8p9')
                                      : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packOrder_q0r1s2t3u4')}
                                  </button>
                                </div>
                                {hasOpenIssues && (
                                  <div className="wms-issue-banner" role="alert">
                                    <FiAlertTriangle aria-hidden />
                                    {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.openIssuesBlock_v5w6x7y8z9')}
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>

      {issueModal && (
        <div className="admin-modal-overlay" onClick={() => setIssueModal(null)} role="presentation">
          <div
            className="admin-modal wms-issue-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wms-issue-modal-title"
          >
            <h2 id="wms-issue-modal-title">
              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueModalTitle_f5g6h7i8j9', {
                value0: issueModal.productName || tUi('ui.pages.warehouseStaff.warehouseStaffOrders.productFallback_r5s6t7u8v9'),
              })}
            </h2>
            <div className="adm-modal-field">
              <label htmlFor="wms-issue-type">{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueType_k0l1m2n3o4')}</label>
              <select
                id="wms-issue-type"
                value={issueForm.issue_type}
                onChange={(e) => setIssueForm({ ...issueForm, issue_type: e.target.value })}
              >
                <option value="damaged">{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDamaged_p5q6r7s8t9')}</option>
                <option value="missing">{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueMissing_u0v1w2x3y4')}</option>
                <option value="other">{tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueOther_z5a6b7c8d9')}</option>
              </select>
            </div>
            <div className="adm-modal-field">
              <label htmlFor="wms-issue-description">
                {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescription_e0f1g2h3i4')}
              </label>
              <textarea
                id="wms-issue-description"
                value={issueForm.description}
                onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                placeholder={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescPlaceholder_j5k6l7m8n9')}
                rows={4}
              />
            </div>
            <div className="adm-modal-actions">
              <button type="button" className="adm-btn-secondary" onClick={() => setIssueModal(null)}>
                {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.cancel_y0z1a2b3c4')}
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                onClick={handleSubmitIssue}
                disabled={submittingIssue || !issueForm.description.trim()}
              >
                {submittingIssue
                  ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueSubmitting_o0p1q2r3s4')
                  : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueSubmit_t5u6v7w8x9')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStaffOrders;

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime, getImageUrl } from '../../utils/helpers';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseApprovals.css';

const WarehouseApprovals = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(t('ui.pages.warehouse.warehouseApprovals.toast.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleApprove = async (orderId) => {
    setApprovingId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.APPROVE_ORDER, { order_id: orderId }));
      toast.success(t('ui.pages.warehouse.warehouseApprovals.toast.approved'));
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.pages.warehouse.warehouseApprovals.toast.failedToApprove'));
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) return <div className="page-loading wm-page-loading"><LoadingSpinner size="large" /></div>;

  return (
    <div className="admin-page-shell wm-page wm-approvals">
      <PageHeader
        kicker={t('ui.sidebar.panel.warehouse')}
        title={t('ui.pages.warehouse.warehouseApprovals.title')}
        subtitle={t('ui.pages.warehouse.warehouseApprovals.subtitle')}
      />

      <section className="wm-section">
        {orders.length === 0 ? (
          <div className="wm-empty">
            <div className="wm-empty-icon">✅</div>
            <p>{t('ui.pages.warehouse.warehouseApprovals.empty')}</p>
          </div>
        ) : (
          <div className="wm-approvals-list">
            <AnimatePresence>
              {orders.map((order, i) => {
                const orderItems = order.items || order.orderitems || [];
                const isExpanded = expandedOrder === order.id;
                return (
                  <motion.div
                    key={order.id}
                    className="wm-approval-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="wm-approval-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                      <div className="wm-approval-header-left">
                        <span className="wm-approval-id">{t('ui.pages.warehouse.warehouseApprovals.orderId', { id: order.id })}</span>
                        <span className="wm-approval-meta">
                          {t('ui.pages.warehouse.warehouseApprovals.itemsCount', { count: orderItems.length })} • {formatDateTime(order.created_at)}
                        </span>
                      </div>
                      <div className="wm-approval-header-right">
                        <span className="wm-approval-total">{formatCurrency(order.total_amount)}</span>
                        <button
                          type="button"
                          className="wm-btn-primary wm-btn-primary--success"
                          onClick={(e) => { e.stopPropagation(); handleApprove(order.id); }}
                          disabled={approvingId === order.id}
                        >
                          <FiCheck aria-hidden />
                          {approvingId === order.id ? t('ui.pages.warehouse.warehouseApprovals.approving') : t('ui.pages.warehouse.warehouseApprovals.approve')}
                        </button>
                        <span className="wm-approval-toggle" aria-hidden>
                          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="wm-approval-details">
                        <div className="wm-approval-items">
                          {orderItems.map(item => (
                            <div key={item.id} className="wm-approval-item">
                              {item.product?.images?.[0] ? (
                                <img src={getImageUrl(item.product.images[0])} alt={item.product?.name} onError={e => { e.target.style.display = 'none'; }} />
                              ) : (
                                <div className="wm-approval-item-placeholder">📦</div>
                              )}
                              <div>
                                <div className="wm-approval-item-name">{item.product?.name}</div>
                                <div className="wm-approval-item-meta">
                                  {t('ui.pages.warehouse.warehouseApprovals.qty')}: {item.quantity} × {formatCurrency(item.price)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.user && (
                          <div className="wm-approval-customer">
                            <strong>{t('ui.pages.warehouse.warehouseApprovals.customer')}:</strong>{' '}
                            {order.user.first_name || ''} {order.user.last_name || ''} — {order.user.email}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
};

export default WarehouseApprovals;

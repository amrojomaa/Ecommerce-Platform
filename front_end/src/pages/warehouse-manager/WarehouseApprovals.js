import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiPackage } from 'react-icons/fi';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime, getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseApprovals.css';

const WarehouseApprovals = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const panelKicker = t('ui.sidebar.panel.warehouse');

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (orderId, event) => {
    event?.stopPropagation();
    setApprovingId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.APPROVE_ORDER, { order_id: orderId }));
      toast.success(t('ui.pages.warehouse.warehouseApprovals.toast.approved'));
      setExpandedOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.pages.warehouse.warehouseApprovals.toast.failedToApprove'));
    } finally {
      setApprovingId(null);
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder((prev) => (prev === orderId ? null : orderId));
  };

  const orderCountLabel =
    orders.length === 1
      ? t('ui.pages.warehouse.warehouseApprovals.orderCountOne')
      : t('ui.pages.warehouse.warehouseApprovals.orderCountMany');

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page wm-page wm-approvals-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.warehouse.warehouseApprovals.title')}
        subtitle={t('ui.pages.warehouse.warehouseApprovals.subtitle')}
        actions={
          <p className="adm-orders-header-meta wm-approvals-header-meta" aria-live="polite">
            <strong>{orders.length}</strong> {orderCountLabel}
          </p>
        }
      />

      <section className="adm-section wm-approvals-section">
        {orders.length === 0 ? (
          <div className="adm-page-empty wm-page-empty">
            <p>{t('ui.pages.warehouse.warehouseApprovals.empty')}</p>
          </div>
        ) : (
          <div className="wm-data-panel wm-approvals-data-panel">
            <div className="wm-approvals-list">
              <AnimatePresence>
                {orders.map((order, i) => {
                  const orderItems = order.items || order.orderitems || [];
                  const isExpanded = expandedOrder === order.id;
                  return (
                    <motion.article
                      key={order.id}
                      className="wm-approval-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <button
                        type="button"
                        className="wm-approval-header"
                        onClick={() => toggleExpand(order.id)}
                        aria-expanded={isExpanded}
                      >
                        <div className="wm-approval-header-left">
                          <span className="wm-approval-id">
                            {t('ui.pages.warehouse.warehouseApprovals.orderId', { id: order.id })}
                          </span>
                          <span className="wm-approval-meta">
                            {t('ui.pages.warehouse.warehouseApprovals.itemsCount', {
                              count: orderItems.length,
                            })}{' '}
                            • {formatDateTime(order.created_at)}
                          </span>
                        </div>
                        <div className="wm-approval-header-right">
                          <span className="wm-approval-total">{formatCurrency(order.total_amount)}</span>
                          <span className={`adm-orders-status adm-orders-status--${(order.status || 'packed').toLowerCase()}`}>
                            {t('ui.pages.orders.status.packed', { defaultValue: 'Packed' })}
                          </span>
                        </div>
                      </button>

                      <div className="wm-approval-actions">
                        <button
                          type="button"
                          className="adm-btn-primary wm-approve-btn"
                          onClick={(e) => handleApprove(order.id, e)}
                          disabled={approvingId === order.id}
                        >
                          <FiCheck aria-hidden />
                          {approvingId === order.id
                            ? t('ui.pages.warehouse.warehouseApprovals.approving')
                            : t('ui.pages.warehouse.warehouseApprovals.approve')}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="wm-approval-details">
                          <div className="wm-approval-items">
                            {orderItems.map((item) => {
                              const imageSrc = item.product?.images?.[0]
                                ? getImageUrl(item.product.images[0])
                                : null;
                              return (
                                <div key={item.id} className="wm-approval-item">
                                  {imageSrc ? (
                                    <img src={imageSrc} alt={item.product?.name || ''} />
                                  ) : (
                                    <div className="wm-approval-item-placeholder" aria-hidden>
                                      <FiPackage />
                                    </div>
                                  )}
                                  <div>
                                    <div className="wm-approval-item-name">{item.product?.name}</div>
                                    <div className="wm-approval-item-meta">
                                      {t('ui.pages.warehouse.warehouseApprovals.qty')}: {item.quantity} ×{' '}
                                      {formatCurrency(item.price)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {order.user && (
                            <div className="wm-approval-customer">
                              <strong>{t('ui.pages.warehouse.warehouseApprovals.customer')}:</strong>{' '}
                              {[order.user.first_name, order.user.last_name].filter(Boolean).join(' ')} —{' '}
                              {order.user.email}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default WarehouseApprovals;

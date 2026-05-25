import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { SELLER_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDate, getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';
import '../../styles/pages/seller/SellerPanel.css';
import '../../styles/pages/seller/SellerOrders.css';

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  pending: 'ui.pages.orders.status.pending',
  paid: 'ui.pages.orders.status.paid',
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  refunded: 'ui.pages.orders.status.refunded',
};

const SELLER_VISIBLE_STATUSES = new Set(['paid', 'preparing']);

const ORDER_STATUS_FILTERS = ['all', 'paid', 'preparing'];

const getOrderStatusLabel = (status) => {
  const normalized = String(status || 'created').toLowerCase();
  const key = ORDER_STATUS_LABEL_KEYS[normalized];
  if (key) return tUi(key);
  return normalized.replace(/_/g, ' ');
};

const SellerOrders = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const panelKicker = t('ui.sidebar.panel.seller');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = searchParams.get('filter');
    return ORDER_STATUS_FILTERS.includes(filter) ? filter : 'all';
  });
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await http.get(SELLER_ENDPOINTS.ORDERS);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching seller orders:', error);
      toast.error(tUi('ui.pages.seller.sellerOrders.loadFailed_a1b2c3d4e5'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (ORDER_STATUS_FILTERS.includes(filter)) {
      setActiveTab(filter);
    } else if (!filter) {
      setActiveTab('all');
    }
  }, [searchParams]);

  const handleStatusFilterChange = (value) => {
    setActiveTab(value);
    if (value === 'all') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ filter: value }, { replace: true });
  };

  const sellerOrders = orders.filter((order) =>
    SELLER_VISIBLE_STATUSES.has(String(order.status || '').toLowerCase())
  );

  const filteredOrders = sellerOrders.filter((order) => {
    if (activeTab === 'all') return true;
    return String(order.status || '').toLowerCase() === activeTab;
  });

  const handleStartPreparing = async (orderId) => {
    setUpdatingOrderId(orderId);
    try {
      await http.patch(buildUrl(SELLER_ENDPOINTS.UPDATE_STATUS, { order_id: orderId }), {
        status: 'preparing',
      });
      toast.success(tUi('ui.pages.seller.sellerOrders.markedPreparing_f6g7h8i9j0'));
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Failed to update order';
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const handleRowKeyDown = (event, orderId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpand(orderId);
    }
  };

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const formatFilterLabel = (value) => {
    if (value === 'all') return tUi('ui.pages.seller.sellerOrders.tabAll_t6u7v8w9x0');
    return getOrderStatusLabel(value);
  };

  const emptyMessage =
    activeTab === 'all'
      ? tUi('ui.pages.seller.sellerOrders.emptyAll_u1v2w3x4y5')
      : tUi('ui.pages.seller.sellerOrders.emptyFiltered_p6q7r8s9t0', {
          value0: formatFilterLabel(activeTab),
        });

  const orderCountLabel =
    filteredOrders.length === 1
      ? tUi('ui.pages.seller.sellerOrders.orderCountOne_h1i2j3k4l5')
      : tUi('ui.pages.seller.sellerOrders.orderCountMany_m6n7o8p9q0');

  return (
    <div className="admin-page-shell adm-page slr-page slr-orders-page adm-orders-page">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.seller.sellerOrders.title_z6a7b8c9d0')}
        subtitle={tUi('ui.pages.seller.sellerOrders.subtitle_e1f2g3h4i5')}
        actions={
          <div className="adm-orders-header-filter slr-orders-header-filter">
            <div className="adm-orders-filter-row">
              <label className="adm-orders-filter-label" htmlFor="slr-orders-status-filter">
                {tUi('ui.pages.seller.sellerOrders.filterByStatus_r1s2t3u4v5')}
              </label>
              <select
                id="slr-orders-status-filter"
                className="adm-orders-select slr-orders-select"
                value={activeTab}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                {ORDER_STATUS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {formatFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-orders-header-meta" aria-live="polite">
              <strong>{filteredOrders.length}</strong> {orderCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-section adm-orders-section slr-orders-section">
        {filteredOrders.length === 0 ? (
          <div className="adm-page-empty slr-orders-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="adm-orders-data-panel slr-orders-data-panel">
            <div className="adm-orders-table-scroll">
              <table className="adm-orders-table slr-orders-table">
                <colgroup>
                  <col className="slr-col-order" />
                  <col className="slr-col-date" />
                  <col className="slr-col-customer" />
                  <col className="slr-col-items" />
                  <col className="slr-col-total" />
                  <col className="slr-col-status" />
                  <col className="slr-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="slr-col-order">{tUi('ui.pages.seller.sellerOrders.colOrder_y1z2a3b4c5')}</th>
                    <th className="slr-col-date">{tUi('ui.pages.seller.sellerOrders.colDate_d5e6f7g8h9')}</th>
                    <th className="slr-col-customer">{tUi('ui.pages.seller.sellerOrders.colCustomer_i0j1k2l3m4')}</th>
                    <th className="slr-col-items">{tUi('ui.pages.seller.sellerOrders.colItems_n5o6p7q8r9')}</th>
                    <th className="slr-col-total">{tUi('ui.pages.seller.sellerOrders.colTotal_s0t1u2v3w4')}</th>
                    <th className="slr-col-status">{tUi('ui.pages.seller.sellerOrders.colStatus_x5y6z7a8b9')}</th>
                    <th className="slr-col-action">{tUi('ui.pages.seller.sellerOrders.colAction_c0d1e2f3g4')}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredOrders.map((order, index) => {
                      const orderItems = order.items || order.orderitems || [];
                      const orderStatus = (order.status || '').toLowerCase();
                      const isExpanded = expandedOrderId === order.id;

                      return (
                        <React.Fragment key={order.id}>
                          <motion.tr
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`slr-orders-row ${isExpanded ? 'is-expanded' : ''}`}
                            onClick={() => toggleExpand(order.id)}
                            onKeyDown={(event) => handleRowKeyDown(event, order.id)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-label={tUi('ui.pages.seller.sellerOrders.toggleDetails_h5i6j7k8l9')}
                          >
                            <td className="adm-orders-id slr-col-order">#{order.id}</td>
                            <td className="slr-col-date">{formatDate(order.created_at)}</td>
                            <td className="slr-col-customer">
                              <div className="adm-orders-customer">
                                <span className="adm-orders-customer-name">
                                  {order.user?.email || order.customer_name || '—'}
                                </span>
                                {order.user?.first_name && order.user?.last_name && (
                                  <span className="adm-orders-customer-meta">
                                    ({order.user.first_name} {order.user.last_name})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="slr-col-items">{orderItems.length}</td>
                            <td className="adm-orders-total slr-col-total">{formatCurrency(order.total_amount)}</td>
                            <td className="slr-col-status">
                              <span className={`adm-orders-status adm-orders-status--${orderStatus || 'paid'}`}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="slr-col-action" onClick={(e) => e.stopPropagation()}>
                              {order.status === 'paid' && (
                                <button
                                  type="button"
                                  className="adm-btn-primary slr-prepare-btn"
                                  onClick={() => handleStartPreparing(order.id)}
                                  disabled={updatingOrderId === order.id}
                                >
                                  {updatingOrderId === order.id
                                    ? tUi('ui.pages.seller.sellerOrders.starting_m0n1o2p3q4')
                                    : tUi('ui.pages.seller.sellerOrders.startPreparing_r5s6t7u8v9')}
                                </button>
                              )}
                              {order.status === 'preparing' && (
                                <span className="slr-in-progress-label">
                                  {tUi('ui.pages.seller.sellerOrders.inProgress_w0x1y2z3a4')}
                                </span>
                              )}
                            </td>
                          </motion.tr>

                          {isExpanded && (
                            <tr className="slr-order-details-row">
                              <td colSpan={7}>
                                <div className="slr-order-details">
                                  <div className="slr-order-items-list">
                                    {orderItems.map((item) => (
                                      <div key={item.id} className="slr-order-item">
                                        <div className="slr-order-item-thumb">
                                          <img
                                            src={
                                              item.product?.images?.[0]
                                                ? getImageUrl(item.product.images[0])
                                                : getImageUrl('/images/placeholder.jpg')
                                            }
                                            alt=""
                                            onError={(e) => {
                                              e.currentTarget.onerror = null;
                                              e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                                            }}
                                          />
                                        </div>
                                        <div className="slr-order-item-copy">
                                          <strong>{item.product?.name || tUi('ui.pages.seller.sellerOrders.productFallback_b1c2d3e4f5')}</strong>
                                          <span>
                                            {tUi('ui.pages.seller.sellerOrders.itemMeta_g6h7i8j9k0', {
                                              value0: item.quantity,
                                              value1: formatCurrency(item.price),
                                              value2: formatCurrency(item.total),
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SellerOrders;

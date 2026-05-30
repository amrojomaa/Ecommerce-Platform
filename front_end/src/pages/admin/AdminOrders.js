import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import OrderMapTracker from '../../components/OrderMapTracker';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  pending: 'ui.pages.orders.status.pending',
  paid: 'ui.pages.orders.status.paid',
  preparing: 'ui.pages.orders.status.preparing',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  refunded: 'ui.pages.orders.status.refunded'
};

const ORDER_STATUSES = [
  'all',
  'revenue',
  'pos',
  'created',
  'paid',
  'preparing',
  'assigned',
  'picked_up',
  'delivering',
  'shipped',
  'delivered',
  'cancelled'
];

const AdminOrders = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedOrderTab, setExpandedOrderTab] = useState('report');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('filter') || 'all');

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (allOrders.length === 0) return;

    if (statusFilter === 'all') {
      setOrders(allOrders);
      return;
    }

    if (statusFilter === 'revenue') {
      setOrders(
        allOrders.filter((order) => {
          const status = (order.status || 'created').toLowerCase();
          return status === 'paid' || status === 'shipped' || status === 'delivered';
        })
      );
      return;
    }

    if (statusFilter === 'pos') {
      setOrders(allOrders.filter((order) => order.sale_channel === 'pos'));
      return;
    }

    setOrders(
      allOrders.filter(
        (order) => (order.status || 'created').toLowerCase() === statusFilter.toLowerCase()
      )
    );
  }, [statusFilter, allOrders]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      const ordersData = Array.isArray(response.data) ? response.data : response.data?.orders || [];
      setAllOrders(ordersData);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch orders';
      setError(errorMessage);
      setAllOrders([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (currentStatus) => {
    if (currentStatus === 'paid') {
      return ['shipped', 'cancelled'];
    }
    if (currentStatus === 'shipped') {
      return ['delivered', 'cancelled'];
    }
    if (['assigned', 'picked_up', 'delivering'].includes(currentStatus)) {
      return ['cancelled'];
    }
    return ['cancelled'];
  };

  const handleStatusFilterChange = (e) => {
    const filterValue = e.target.value;
    setStatusFilter(filterValue);
    if (filterValue === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterValue });
    }
  };

  const getOrderStatusLabel = (status) => {
    const normalized = String(status || 'created').toLowerCase();
    const key = ORDER_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return normalized.replace(/_/g, ' ');
  };

  const formatFilterLabel = (value) => {
    if (value === 'pos') return tUi('ui.pages.admin.adminOrders.pos_a479fcd150');
    if (value === 'revenue') return tUi('ui.pages.admin.adminOrders.revenue_a1caf5553a');
    if (value === 'all') return tUi('ui.pages.admin.adminOrders.all_80e364fbdb');
    return getOrderStatusLabel(value);
  };

  const getEmptyMessage = () => {
    if (statusFilter === 'all') {
      return tUi('ui.pages.admin.adminOrders.noOrdersFound_fc2cb6ab28');
    }
    if (statusFilter === 'revenue') {
      return tUi('ui.pages.admin.adminOrders.noOrdersFoundWithStatus_935a07a75e');
    }
    if (statusFilter === 'pos') {
      return tUi('ui.pages.admin.adminOrders.noInStorePosOrders_e985e1c501');
    }
    return tUi('ui.pages.admin.adminOrders.noOrdersFoundWithStatus_abbac05c5c', {
      value0: formatFilterLabel(statusFilter)
    });
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updateUrl = ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', orderId);
      await http.patch(updateUrl, { status: newStatus });

      const updatedOrder = { ...orders.find((o) => o.id === orderId), status: newStatus };

      setAllOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
      setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
      setSelectedStatus({ ...selectedStatus, [orderId]: '' });
      toast.success(tUi('ui.pages.admin.adminOrders.orderStatusUpdatedSuccessfully_fc30445a1d'));
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update order status';
      toast.error(`Failed to update order status: ${errorMsg}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const allOrdersTitle = tUi('ui.pages.admin.adminOrders.allOrders_4b39990b5b');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });
  const orderCountLabel =
    orders.length === 1
      ? tUi('ui.pages.admin.adminOrders.order_34aea86a72')
      : tUi('ui.pages.admin.adminOrders.orders_0e0e34ceea');

  return (
    <div className="admin-page-shell adm-page adm-orders-page">
      <PageHeader
        kicker={panelKicker}
        title={allOrdersTitle}
        subtitle={tUi('ui.pages.admin.adminOrders.subtitle_1a2b3c4d5e')}
        actions={
          <div className="adm-orders-header-filter">
            <div className="adm-orders-filter-row">
              <label className="adm-orders-filter-label" htmlFor="adm-orders-status-filter">
                {tUi('ui.pages.admin.adminOrders.filterByStatus_c0507d4cfa')}
              </label>
              <select
                id="adm-orders-status-filter"
                className="adm-orders-select"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatFilterLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-orders-header-meta" aria-live="polite">
              <strong>{orders.length}</strong> {orderCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-orders-section">
        {loading ? (
          <div className="adm-orders-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : error ? (
          <div className="adm-orders-error">
            <p>
              <strong>{tUi('ui.pages.admin.adminOrders.error_4f8aad30a6')}</strong> {error}
            </p>
            <button type="button" className="adm-btn-primary" onClick={fetchOrders}>
              {tUi('ui.pages.admin.adminOrders.retry_b584d994cc')}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="adm-orders-empty">
            <p>{getEmptyMessage()}</p>
            {statusFilter !== 'all' && (
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchParams({});
                }}
              >
                {tUi('ui.pages.admin.adminOrders.showAllOrders_a234fdd874')}
              </button>
            )}
          </div>
        ) : (
          <div className="adm-orders-data-panel">
            <div className="adm-orders-table-scroll">
              <table className="adm-orders-table">
                <thead>
                  <tr>
                    <th>{tUi('ui.pages.admin.adminOrders.orderId_87fb94b0ea')}</th>
                    <th>{tUi('ui.pages.admin.adminOrders.customer_af49dd1c93')}</th>
                    <th>{tUi('ui.pages.admin.adminOrders.saleChannel_6e7f8a9b0c')}</th>
                    <th>{tUi('ui.pages.admin.adminOrders.date_d12a0581d9')}</th>
                    <th>{tUi('ui.pages.admin.adminOrders.items_716d042f1e')}</th>
                    <th>{tUi('ui.pages.admin.adminOrders.total_fe96c090ae')}</th>
                    <th className="adm-orders-col-status">
                      {tUi('ui.pages.admin.adminOrders.status_7bb0ee7637')}
                    </th>
                    <th className="adm-orders-col-actions">
                      {tUi('ui.pages.admin.adminOrders.actions_8926462604')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const orderStatus = (order.status || '').toLowerCase();
                    const isExpanded = expandedOrderId === order.id;

                    return (
                      <React.Fragment key={order.id}>
                        <motion.tr
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={isExpanded ? 'is-expanded' : ''}
                        >
                          <td className="adm-orders-id">#{order.id}</td>
                          <td>
                            {order.sale_channel === 'pos' ? (
                              <div className="adm-orders-customer">
                                <span className="adm-orders-customer-name">
                                  {order.customer_name || 'Walk-in Customer'}
                                </span>
                                <span className="adm-orders-customer-meta">
                                  {order.cashier
                                    ? `Cashier: ${order.cashier.email}`
                                    : tUi('ui.pages.admin.adminOrders.cashierNotRecorded_fc0dc3a12d')}
                                </span>
                              </div>
                            ) : (
                              <div className="adm-orders-customer">
                                <span className="adm-orders-customer-name">
                                  {order.user?.email || tUi('ui.pages.admin.adminOrders.nA_eb6526e85d')}
                                </span>
                                {order.user?.first_name && order.user?.last_name && (
                                  <span className="adm-orders-customer-meta">
                                    ({order.user.first_name} {order.user.last_name})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {order.sale_channel === 'pos' ? (
                              <span className="adm-orders-channel adm-orders-channel--pos">
                                {tUi('ui.pages.admin.adminOrders.inStorePosSale_28efdad1f0')}
                              </span>
                            ) : (
                              <span className="adm-orders-channel adm-orders-channel--online">
                                {tUi('ui.pages.admin.adminOrders.onlineChannel_8b9c0d1e2f')}
                              </span>
                            )}
                          </td>
                          <td>{formatDate(order.created_at)}</td>
                          <td>{order.items?.length || order.orderitems?.length || 0}</td>
                          <td className="adm-orders-total">{formatCurrency(order.total_amount)}</td>
                          <td className="adm-orders-col-status">
                            <span className={`adm-orders-status adm-orders-status--${orderStatus || 'created'}`}>
                              {getOrderStatusLabel(order.status || 'created')}
                            </span>
                          </td>
                          <td className="adm-orders-col-actions">
                            <div className="adm-orders-actions">
                              {getAvailableStatuses(order.status || 'created').length > 0 ? (
                                <select
                                  value={selectedStatus[order.id] || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleStatusChange(order.id, e.target.value);
                                    }
                                  }}
                                  disabled={updatingOrderId === order.id}
                                  className="adm-orders-status-select"
                                  aria-label={tUi('ui.pages.admin.adminOrders.changeStatus_82cd1fa50c')}
                                >
                                  <option value="">
                                    {tUi('ui.pages.admin.adminOrders.changeStatus_82cd1fa50c')}
                                  </option>
                                  {getAvailableStatuses(order.status || 'created').map((status) => (
                                    <option key={status} value={status}>
                                      {getOrderStatusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="adm-orders-muted">
                                  {tUi('ui.pages.admin.adminOrders.noActions_8095e03ffa')}
                                </span>
                              )}

                              {(order.order_delivery?.issue_type ||
                                (order.order_delivery?.photos?.length || 0) > 0) && (
                                <button
                                  type="button"
                                  className="adm-orders-btn-issue"
                                  onClick={() => {
                                    setExpandedOrderTab('report');
                                    setExpandedOrderId(
                                      isExpanded && expandedOrderTab === 'report' ? null : order.id
                                    );
                                  }}
                                >
                                  {isExpanded && expandedOrderTab === 'report'
                                    ? tUi('ui.pages.admin.adminOrders.hideReport_ede910d752')
                                    : tUi('ui.pages.admin.adminOrders.viewReport_1b00ec094c')}
                                </button>
                              )}

                              {order.order_delivery?.id && (
                                <button
                                  type="button"
                                  className="adm-orders-btn-map"
                                  onClick={() => {
                                    setExpandedOrderTab('map');
                                    setExpandedOrderId(
                                      isExpanded && expandedOrderTab === 'map' ? null : order.id
                                    );
                                  }}
                                >
                                  {tUi('ui.pages.admin.adminOrders.trackDriver_4d5e6f7a8b')}
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>

                        {isExpanded && (
                          <tr className="adm-orders-expanded-row">
                            <td colSpan={8}>
                              <div className="adm-orders-expanded-panel">
                                <div className="adm-orders-tabs">
                                  <button
                                    type="button"
                                    className={expandedOrderTab === 'report' ? 'is-active' : ''}
                                    onClick={() => setExpandedOrderTab('report')}
                                  >
                                    {tUi('ui.pages.admin.adminOrders.driverReport_1685bd9703')}
                                  </button>
                                  {order.order_delivery?.id && (
                                    <button
                                      type="button"
                                      className={expandedOrderTab === 'map' ? 'is-active' : ''}
                                      onClick={() => setExpandedOrderTab('map')}
                                    >
                                      {tUi('ui.pages.admin.adminOrders.liveTrackingMap_5e6f7a8b9c')}
                                    </button>
                                  )}
                                </div>

                                {expandedOrderTab === 'report' && (
                                  <div className="adm-orders-report">
                                    {order.order_delivery?.issue_type ? (
                                      <p className="adm-orders-report-line">
                                        <strong>{tUi('ui.pages.admin.adminOrders.type_5479c42965')}</strong>{' '}
                                        {order.order_delivery.issue_type.replace(/_/g, ' ')}
                                      </p>
                                    ) : (
                                      <p className="adm-orders-report-line">
                                        {tUi('ui.pages.admin.adminOrders.noIssueTypeProvided_be64d46132')}
                                      </p>
                                    )}

                                    {order.order_delivery?.issue_description && (
                                      <p className="adm-orders-report-line">
                                        <strong>
                                          {tUi('ui.pages.admin.adminOrders.description_ddd5e10a09')}
                                        </strong>{' '}
                                        {order.order_delivery.issue_description}
                                      </p>
                                    )}

                                    {Array.isArray(order.order_delivery?.photos) &&
                                      order.order_delivery.photos.length > 0 && (
                                        <div className="adm-orders-photo-grid">
                                          {order.order_delivery.photos.map((photo) => (
                                            <div className="adm-orders-photo-card" key={`order-photo-${photo.id}`}>
                                              <img
                                                src={getImageUrl(photo.image_path)}
                                                alt={tUi('ui.pages.admin.adminOrders.deliveryValue_8de82198a5', {
                                                  value0: photo.photo_type
                                                })}
                                              />
                                              <span>{photo.photo_type.replace(/_/g, ' ')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                )}

                                {expandedOrderTab === 'map' && order.order_delivery?.id && (
                                  <div className="adm-orders-map">
                                    <OrderMapTracker deliveryJob={order.order_delivery} />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminOrders;

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { SELLER_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import API_BASE_URL from '../../config/api';
import '../../styles/pages/seller/SellerOrders.css';

const SellerOrders = () => {
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('paid');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await http.get(SELLER_ENDPOINTS.ORDERS);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching seller orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    return order.status === activeTab;
  });

  const paidCount = orders.filter((o) => o.status === 'paid').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;

  const handleStartPreparing = async (orderId) => {
    setUpdatingOrderId(orderId);
    try {
      await http.patch(buildUrl(SELLER_ENDPOINTS.UPDATE_STATUS, { order_id: orderId }), {
        status: 'preparing',
      });
      toast.success('Order marked as Preparing');
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Failed to update order';
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="page-loading seller-orders-loading"><LoadingSpinner size="large" /></div>;
  }

  const ordersTitle = 'Orders';

  return (
    <div className="admin-page-shell seller-orders">
      <PageHeader kicker={ordersTitle} title={ordersTitle} />

      <div className="seller-orders-tabs">
        <button
          className={activeTab === 'paid' ? 'active' : ''}
          onClick={() => setActiveTab('paid')}
        >
          Paid
          {paidCount > 0 && <span className="tab-count">{paidCount}</span>}
        </button>
        <button
          className={activeTab === 'preparing' ? 'active' : ''}
          onClick={() => setActiveTab('preparing')}
        >
          Preparing
          {preparingCount > 0 && <span className="tab-count">{preparingCount}</span>}
        </button>
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="seller-orders-empty">
          <div className="empty-icon">📋</div>
          <p>
            {activeTab === 'paid'
              ? 'No paid orders waiting for preparation'
              : activeTab === 'preparing'
              ? 'No orders currently being prepared'
              : 'No orders found'
            }
          </p>
        </div>
      ) : (
        <table className="seller-orders-table">
          <thead>
            <tr>
              <th></th>
              <th>Order #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={expandedOrder === order.id ? 'expanded' : ''}
                  >
                    <td>
                      <button
                        className={`seller-expand-btn ${expandedOrder === order.id ? 'expanded' : ''}`}
                        onClick={() => toggleExpand(order.id)}
                      >
                        ▼
                      </button>
                    </td>
                    <td><strong>#{order.id}</strong></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.user?.email || order.customer_name || '—'}</td>
                    <td>{(order.items || order.orderitems || []).length} item{((order.items || order.orderitems || []).length) !== 1 ? 's' : ''}</td>
                    <td><strong>{formatCurrency(order.total_amount)}</strong></td>
                    <td>
                      <span className={`seller-status-badge ${order.status}`}>
                        {order.status === 'ready_for_pickup' ? 'Ready' : order.status}
                      </span>
                    </td>
                    <td>
                      {order.status === 'paid' && (
                        <button
                          className="seller-prepare-btn"
                          onClick={() => handleStartPreparing(order.id)}
                          disabled={updatingOrderId === order.id}
                        >
                          {updatingOrderId === order.id ? 'Starting...' : '🔧 Start Preparing'}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.85rem' }}>⏳ In Progress</span>
                      )}
                    </td>
                  </motion.tr>

                  {/* Expanded order details */}
                  {expandedOrder === order.id && (
                    <tr className="seller-order-details">
                      <td colSpan={8}>
                        <div className="seller-order-items-list">
                          {(order.items || order.orderitems || []).map((item) => (
                            <div key={item.id} className="seller-order-item">
                              {item.product?.images?.[0] ? (
                                <img
                                  src={item.product.images[0].startsWith('http') ? item.product.images[0] : `${API_BASE_URL}/${item.product.images[0]}`}
                                  alt={item.product?.name}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                              )}
                              <div className="seller-order-item-info">
                                <div className="seller-order-item-name">{item.product?.name || 'Product'}</div>
                                <div className="seller-order-item-meta">
                                  Qty: {item.quantity} × {formatCurrency(item.price)} = {formatCurrency(item.total)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.user && (
                          <div className="seller-order-customer">
                            <strong>Customer:</strong> {order.user.first_name || ''} {order.user.last_name || ''} — {order.user.email}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SellerOrders;

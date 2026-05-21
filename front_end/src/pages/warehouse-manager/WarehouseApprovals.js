import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import API_BASE_URL from '../../config/api';
import '../../styles/pages/warehouse-manager/WarehouseApprovals.css';

const WarehouseApprovals = () => {
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
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleApprove = async (orderId) => {
    setApprovingId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.APPROVE_ORDER, { order_id: orderId }));
      toast.success('Order approved — ready for pickup!');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="wm-approvals-loading"><LoadingSpinner size="large" /></div>;

  return (
    <div className="wm-approvals">
      <h1>Order Approvals</h1>
      {orders.length === 0 ? (
        <div className="wm-approvals-empty">
          <div className="empty-icon">✅</div>
          <p>No packed orders waiting for approval</p>
        </div>
      ) : (
        <AnimatePresence>
          {orders.map(order => {
            const orderItems = order.items || order.orderitems || [];
            return (
            <motion.div key={order.id} className="wm-approval-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="wm-approval-header" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                <div className="wm-approval-header-left">
                  <span className="wm-approval-id">Order #{order.id}</span>
                  <span className="wm-approval-meta">{orderItems.length} items • {formatDate(order.created_at)}</span>
                </div>
                <div className="wm-approval-header-right">
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(order.total_amount)}</span>
                  <button className="wm-approve-btn" onClick={(e) => { e.stopPropagation(); handleApprove(order.id); }} disabled={approvingId === order.id}>
                    {approvingId === order.id ? 'Approving...' : '✅ Approve'}
                  </button>
                </div>
              </div>
              {expandedOrder === order.id && (
                <div className="wm-approval-details">
                  <div className="wm-approval-items">
                    {orderItems.map(item => (
                      <div key={item.id} className="wm-approval-item">
                        {item.product?.images?.[0] ? (
                          <img src={item.product.images[0].startsWith('http') ? item.product.images[0] : `${API_BASE_URL}/${item.product.images[0]}`} alt={item.product?.name} onError={e => { e.target.style.display = 'none'; }} />
                        ) : <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>}
                        <div>
                          <div className="wm-approval-item-name">{item.product?.name}</div>
                          <div className="wm-approval-item-meta">Qty: {item.quantity} × {formatCurrency(item.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.user && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                      <strong style={{ color: '#1e293b' }}>Customer:</strong> {order.user.first_name || ''} {order.user.last_name || ''} — {order.user.email}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
          })}
        </AnimatePresence>
      )}
    </div>
  );
};

export default WarehouseApprovals;

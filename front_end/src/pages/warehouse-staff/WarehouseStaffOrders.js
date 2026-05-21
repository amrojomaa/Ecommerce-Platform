import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import API_BASE_URL from '../../config/api';
import '../../styles/pages/warehouse-staff/WarehouseStaffOrders.css';

const WarehouseStaffOrders = () => {
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [packedOrders, setPackedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('preparing');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [verifications, setVerifications] = useState({}); // { orderId: { itemId: bool } }
  const [packingOrderId, setPackingOrderId] = useState(null);

  // Issue report modal
  const [issueModal, setIssueModal] = useState(null); // { orderId, orderItemId, productName }
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
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch verifications when expanding an order
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
    } else {
      setExpandedOrder(orderId);
      if (!verifications[orderId]) {
        loadVerifications(orderId);
      }
    }
  };

  const handleVerifyItem = async (orderId, orderItemId, verified) => {
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.VERIFY_ITEM, { order_id: orderId }), {
        order_item_id: orderItemId,
        verified,
      });

      // Update local state
      setVerifications((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          [orderItemId]: verified ? { verified: true } : { verified: false },
        },
      }));
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to update verification';
      toast.error(msg);
    }
  };

  const isItemVerified = (orderId, itemId) => {
    return verifications[orderId]?.[itemId]?.verified === true;
  };

  const getVerifiedCount = (orderId, items) => {
    if (!items || !verifications[orderId]) return 0;
    return items.filter((item) => verifications[orderId]?.[item.id]?.verified === true).length;
  };

  const handlePackOrder = async (orderId) => {
    setPackingOrderId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.PACK_ORDER, { order_id: orderId }));
      toast.success('Order packed successfully!');
      setExpandedOrder(null);
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to pack order';
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
      toast.error('Please describe the issue');
      return;
    }
    setSubmittingIssue(true);
    try {
      await http.post(buildUrl(WAREHOUSE_ENDPOINTS.REPORT_ISSUE, { order_id: issueModal.orderId }), {
        order_item_id: issueModal.orderItemId,
        issue_type: issueForm.issue_type,
        description: issueForm.description,
      });
      toast.success('Issue reported to warehouse manager');
      setIssueModal(null);
      fetchOrders();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to report issue';
      toast.error(msg);
    } finally {
      setSubmittingIssue(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const displayOrders = activeTab === 'preparing' ? orders : packedOrders;

  if (loading) {
    return <div className="page-loading ws-orders-loading"><LoadingSpinner size="large" /></div>;
  }

  const wsOrdersTitle = 'Warehouse Orders';

  return (
    <div className="admin-page-shell ws-orders">
      <PageHeader
        kicker={wsOrdersTitle}
        title={wsOrdersTitle}
        actions={
        <div className="ws-orders-tabs">
          <button className={activeTab === 'preparing' ? 'active' : ''} onClick={() => setActiveTab('preparing')}>
            Preparing
            {orders.length > 0 && <span className="ws-tab-count">{orders.length}</span>}
          </button>
          <button className={activeTab === 'packed' ? 'active' : ''} onClick={() => setActiveTab('packed')}>
            Packed / Done
            {packedOrders.length > 0 && <span className="ws-tab-count">{packedOrders.length}</span>}
          </button>
        </div>
        }
      />

      {displayOrders.length === 0 ? (
        <div className="ws-orders-empty">
          <div className="empty-icon">{activeTab === 'preparing' ? '📋' : '✅'}</div>
          <p>{activeTab === 'preparing' ? 'No orders waiting to be packed' : 'No packed orders yet'}</p>
        </div>
      ) : (
        <AnimatePresence>
          {displayOrders.map((order) => {
            const orderItems = order.items || order.orderitems || [];
            return (
            <motion.div
              key={order.id}
              className="ws-order-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Header */}
              <div className="ws-order-card-header" onClick={() => toggleExpand(order.id)}>
                <div className="ws-order-card-header-left">
                  <span className="ws-order-id">Order #{order.id}</span>
                  <span className="ws-order-meta">
                    {orderItems.length} items • {formatDate(order.created_at)}
                  </span>
                </div>
                <div className="ws-order-card-header-right">
                  <span className={`ws-status-badge ${order.status}`}>
                    {order.status === 'ready_for_pickup' ? 'Ready' : order.status}
                  </span>
                  <span className={`ws-expand-icon ${expandedOrder === order.id ? 'expanded' : ''}`}>▼</span>
                </div>
              </div>

              {/* Expanded: Verification Checklist */}
              {expandedOrder === order.id && (
                <div className="ws-order-details">
                  <div className="ws-verification-section">
                    <h3>🔍 Verification Checklist</h3>
                    {orderItems.map((item) => {
                      const verified = isItemVerified(order.id, item.id);
                      return (
                        <div key={item.id} className={`ws-verify-item ${verified ? 'verified' : ''}`}>
                          <input
                            type="checkbox"
                            className="verify-checkbox"
                            checked={verified}
                            onChange={(e) => handleVerifyItem(order.id, item.id, e.target.checked)}
                            disabled={order.status !== 'preparing'}
                          />
                          {item.product?.images?.[0] ? (
                            <img
                              src={item.product.images[0].startsWith('http') ? item.product.images[0] : `${API_BASE_URL}/${item.product.images[0]}`}
                              alt={item.product?.name}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                          )}
                          <div className="ws-verify-item-info">
                            <div className="ws-verify-item-name">{item.product?.name || 'Product'}</div>
                            <div className="ws-verify-item-meta">
                              Qty: {item.quantity} × {formatCurrency(item.price)}
                            </div>
                          </div>
                          {order.status === 'preparing' && (
                            <div className="ws-verify-item-actions">
                              <button
                                className="ws-report-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openIssueModal(order.id, item.id, item.product?.name);
                                }}
                              >
                                ⚠️ Report
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pack action */}
                  {order.status === 'preparing' && (() => {
                    const hasOpenIssues = Array.isArray(order.warehouse_issues) && order.warehouse_issues.some(issue => issue.status === 'open');
                    return (
                    <div className="ws-pack-section" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasOpenIssues ? '0.75rem' : '0' }}>
                        <span className="ws-verify-progress">
                          <strong>{getVerifiedCount(order.id, orderItems)}</strong> / {orderItems.length} items verified
                        </span>
                        <button
                          className="ws-pack-btn"
                          disabled={
                            getVerifiedCount(order.id, orderItems) < orderItems.length ||
                            packingOrderId === order.id ||
                            hasOpenIssues
                          }
                          onClick={() => handlePackOrder(order.id)}
                        >
                          {packingOrderId === order.id ? 'Packing...' : '📦 Pack Order'}
                        </button>
                      </div>
                      {hasOpenIssues && (
                        <div style={{ color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #f87171', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center', fontWeight: '500' }}>
                          ⚠️ Cannot pack order: There are unresolved issues reported for this order. Awaiting Warehouse Manager resolution.
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* Customer info */}
                  {order.user && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: 10, fontSize: '0.85rem', color: '#64748b' }}>
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

      {/* Issue Report Modal */}
      {issueModal && (
        <div className="ws-issue-modal-overlay" onClick={() => setIssueModal(null)}>
          <div className="ws-issue-modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Report Issue — {issueModal.productName || 'Item'}</h3>
            <div className="form-group">
              <label>Issue Type</label>
              <select
                value={issueForm.issue_type}
                onChange={(e) => setIssueForm({ ...issueForm, issue_type: e.target.value })}
              >
                <option value="damaged">Damaged</option>
                <option value="missing">Missing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={issueForm.description}
                onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                placeholder="Describe the issue..."
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIssueModal(null)}>Cancel</button>
              <button
                className="submit-btn"
                onClick={handleSubmitIssue}
                disabled={submittingIssue || !issueForm.description.trim()}
              >
                {submittingIssue ? 'Reporting...' : 'Report Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStaffOrders;

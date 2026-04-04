import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { formatPrice, formatDate, getImageUrl } from '../../utils/helpers';
import { ORDER_ENDPOINTS } from '../../config/api';
import { useLanguage } from '../../hooks/useLanguage';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminOrders.css';

const AdminOrders = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Store all orders for filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(() => {
    // Initialize from URL parameter if present
    const filterParam = searchParams.get('filter');
    return filterParam || 'all';
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  // Apply filter when statusFilter changes or when orders are loaded
  useEffect(() => {
    if (allOrders.length > 0) {
      if (statusFilter === 'all') {
        setOrders(allOrders);
      } else if (statusFilter === 'revenue') {
        // Filter for revenue orders: paid, shipped, and delivered
        const filtered = allOrders.filter(order => {
          const status = (order.status || 'created').toLowerCase();
          return status === 'paid' || status === 'shipped' || status === 'delivered';
        });
        setOrders(filtered);
      } else {
        const filtered = allOrders.filter(order => 
          (order.status || 'created').toLowerCase() === statusFilter.toLowerCase()
        );
        setOrders(filtered);
      }
    }
  }, [statusFilter, allOrders]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      console.log('Orders API Response:', response);
      console.log('Orders Data:', response.data);
      
      // Handle both array and object responses
      const ordersData = Array.isArray(response.data) ? response.data : (response.data?.orders || []);
      setAllOrders(ordersData); // Store all orders - the useEffect will handle filtering
      
      if (ordersData.length === 0) {
        console.log('No orders found in database');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data,
        response: error.response
      });
      
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch orders';
      setError(errorMessage);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (currentStatus) => {
    // Admin can change:
    // - paid → shipped
    // - shipped → delivered
    // - any status → cancelled
    // Delivery statuses (assigned, picked_up, delivering) are set by drivers — admin can only cancel
    if (currentStatus === 'paid') {
      return ['shipped', 'cancelled'];
    } else if (currentStatus === 'shipped') {
      return ['delivered', 'cancelled'];
    } else if (['assigned', 'picked_up', 'delivering'].includes(currentStatus)) {
      return ['cancelled'];
    } else {
      return ['cancelled'];
    }
  };

  const handleStatusFilterChange = (e) => {
    const filterValue = e.target.value;
    setStatusFilter(filterValue);
    
    // Update URL parameter
    if (filterValue === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterValue });
    }
  };

  const orderStatuses = ['all', 'revenue', 'created', 'paid', 'assigned', 'picked_up', 'delivering', 'shipped', 'delivered', 'cancelled'];

  const getOrderStatusLabel = (status) => {
    const normalized = (status || 'created').toLowerCase();
    const statusMap = {
      created: t('statusCreated', 'created'),
      paid: t('statusPaid', 'paid'),
      shipped: t('statusShipped', 'shipped'),
      delivered: t('statusDelivered', 'delivered'),
      cancelled: t('statusCancelled', 'cancelled'),
      all: t('all', 'All'),
      revenue: t('revenue', 'Revenue'),
    };
    return statusMap[normalized] || status;
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updateUrl = ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', orderId);
      const response = await http.patch(updateUrl, { status: newStatus });
      
      // Update the order in both filtered and all orders lists
      const updatedOrder = { ...orders.find(o => o.id === orderId), status: newStatus };
      
      setAllOrders(prevAllOrders => 
        prevAllOrders.map(order => 
          order.id === orderId ? updatedOrder : order
        )
      );
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? updatedOrder : order
        )
      );
      
      setSelectedStatus({ ...selectedStatus, [orderId]: '' });
      toast.success(t('orderStatusUpdatedSuccessfully', 'Order status updated successfully'));
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMsg = error.response?.data?.detail || error.message || t('failedUpdateOrderStatus', 'Failed to update order status');
      toast.error(`${t('failedUpdateOrderStatus', 'Failed to update order status')}: ${errorMsg}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-orders-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-orders">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{t('allOrders', 'All Orders')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="status-filter" style={{ fontWeight: '500' }}>{t('filterByStatus', 'Filter by Status')}:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            {orderStatuses.map(status => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
          {statusFilter !== 'all' && (
            <span style={{ color: '#666', fontSize: '14px' }}>
              ({orders.length} {orders.length === 1 ? t('order', 'order') : t('orders', 'orders')})
            </span>
          )}
        </div>
      </div>
      
      {error ? (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            padding: '20px', 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            borderRadius: '8px',
            margin: '20px 0'
          }}
        >
          <p><strong>Error:</strong> {error}</p>
          <button 
            onClick={fetchOrders}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </motion.div>
      ) : orders.length === 0 ? (
        <motion.div
          className="empty-orders"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>
            {statusFilter === 'all' 
              ? 'No orders found.'
              : statusFilter === 'revenue'
              ? 'No orders found with status "paid", "shipped", or "delivered".'
              : `No orders found with status "${statusFilter}".`}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSearchParams({});
              }}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Show All Orders
            </button>
          )}
        </motion.div>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>{t('orderId', 'Order ID')}</th>
                <th>{t('customer', 'Customer')}</th>
                <th>{t('date', 'Date')}</th>
                <th>{t('items', 'Items')}</th>
                <th>{t('total', 'Total')}</th>
                <th>{t('status', 'Status')}</th>
                <th>{t('notification', 'Notification')}</th>
                <th>{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <React.Fragment key={order.id}>
                  {(() => {
                    const orderStatus = (order.status || '').toLowerCase();
                    const showIssueNotification = !!order.order_delivery?.issue_type && !order.order_delivery?.issue_resolved && !['cancelled', 'delivered'].includes(orderStatus);
                    return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={expandedOrderId === order.id ? 'row-expanded' : ''}
                  >
                    <td>#{order.id}</td>
                    <td>
                      {order.user?.email || 'N/A'}
                      {order.user?.first_name && order.user?.last_name && (
                        <span className="user-name">
                          {' '}({order.user.first_name} {order.user.last_name})
                        </span>
                      )}
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items?.length || order.orderitems?.length || 0}</td>
                    <td>{formatPrice(order.total_amount)}</td>
                    <td>
                      <span className={`order-status status-${order.status || 'created'}`}>
                        {getOrderStatusLabel(order.status || 'created')}
                      </span>
                    </td>
                    <td>
                      {showIssueNotification ? (
                        <span className="issue-notification-badge">{t('driverIssue', 'Driver Issue')}</span>
                      ) : (
                        <span className="no-action">{t('none', 'None')}</span>
                      )}
                    </td>
                    <td>
                      <div className="order-actions-cell">
                        {getAvailableStatuses(order.status || 'created').length > 0 ? (
                          <select
                            value={selectedStatus[order.id] || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleStatusChange(order.id, e.target.value);
                              }
                            }}
                            disabled={updatingOrderId === order.id}
                            className="status-select"
                          >
                            <option value="">{t('changeStatus', 'Change status')}...</option>
                            {getAvailableStatuses(order.status || 'created').map(status => (
                              <option key={status} value={status}>
                                {getOrderStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="no-action">{t('noActions', 'No actions')}</span>
                        )}

                        {(order.order_delivery?.issue_type || (order.order_delivery?.photos?.length || 0) > 0) && (
                          <button
                            className="btn-view-issue"
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                          >
                            {expandedOrderId === order.id ? t('hideReport', 'Hide report') : t('viewReport', 'View report')}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                    );
                  })()}

                  {expandedOrderId === order.id && (
                    <tr className="order-expanded-row">
                      <td colSpan="8">
                        <div className="order-expanded-panel">
                          <h4>{t('driverReport', 'Driver Report')}</h4>
                          {order.order_delivery?.issue_type ? (
                            <p className="issue-report-line">
                              <strong>{t('type', 'Type')}:</strong> {order.order_delivery.issue_type.replace(/_/g, ' ')}
                            </p>
                          ) : (
                            <p className="issue-report-line">{t('noIssueTypeProvided', 'No issue type provided.')}</p>
                          )}

                          {order.order_delivery?.issue_description && (
                            <p className="issue-report-line">
                              <strong>{t('description', 'Description')}:</strong> {order.order_delivery.issue_description}
                            </p>
                          )}

                          {Array.isArray(order.order_delivery?.photos) && order.order_delivery.photos.length > 0 && (
                            <div className="order-issue-photo-grid">
                              {order.order_delivery.photos.map((photo) => (
                                <div className="order-issue-photo-card" key={`order-photo-${photo.id}`}>
                                  <img src={getImageUrl(photo.image_path)} alt={`Delivery ${photo.photo_type}`} />
                                  <span>{photo.photo_type.replace(/_/g, ' ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

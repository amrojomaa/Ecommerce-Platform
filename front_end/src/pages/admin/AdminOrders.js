import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';
import { formatPrice, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminOrders.css';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (currentStatus) => {
    const statuses = ['created', 'paid', 'shipped', 'delivered', 'cancelled'];
    
    // Admin can change:
    // - paid → shipped
    // - shipped → delivered
    // - any status → cancelled
    if (currentStatus === 'paid') {
      return ['shipped', 'cancelled'];
    } else if (currentStatus === 'shipped') {
      return ['delivered', 'cancelled'];
    } else {
      return ['cancelled'];
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updateUrl = ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', orderId);
      const response = await http.patch(updateUrl, { status: newStatus });
      
      // Update the order in the list
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      
      setSelectedStatus({ ...selectedStatus, [orderId]: '' });
      alert('Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to update order status';
      alert(`Failed to update order status: ${errorMsg}`);
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
      <h1>All Orders</h1>
      
      {orders.length === 0 ? (
        <motion.div
          className="empty-orders"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>No orders found.</p>
        </motion.div>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
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
                      {order.status || 'created'}
                    </span>
                  </td>
                  <td>
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
                        <option value="">Change status...</option>
                        {getAvailableStatuses(order.status || 'created').map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="no-action">No actions</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

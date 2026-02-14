import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatPrice, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminOrders.css';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Note: This endpoint may need to be added to your FastAPI backend
      // For now, we'll show a placeholder message
      // const response = await http.get('/orders/all');
      // setOrders(response.data);
      
      setOrders([]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
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
          <p className="note">
            Note: Orders endpoint needs to be implemented in the backend.
          </p>
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
                  <td>{order.user?.email || 'N/A'}</td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>{order.items?.length || 0}</td>
                  <td>{formatPrice(order.total_amount)}</td>
                  <td>
                    <span className="order-status">Completed</span>
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

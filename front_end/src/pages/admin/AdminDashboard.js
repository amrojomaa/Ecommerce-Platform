import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, ORDER_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS, DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const isOperationsManager = user?.role === 'operations_manager';
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    activeDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [thresholdInput, setThresholdInput] = useState('');
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [updatingThreshold, setUpdatingThreshold] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isOperationsManager) {
      navigate('/admin/orders', { replace: true });
      return;
    }
    const initializeData = async () => {
      await fetchLowStockThreshold();
      await fetchStats();
    };
    initializeData();
  }, [isOperationsManager, navigate]);

  const fetchLowStockThreshold = async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      const threshold = response.data.threshold;
      setLowStockThreshold(threshold);
      setThresholdInput(threshold.toString());
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      // Use default value of 10 if fetch fails
      setLowStockThreshold(10);
      setThresholdInput('10');
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch products
      const productsResponse = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const products = productsResponse.data;
      
      const lowStock = products.filter(p => p.quantity < lowStockThreshold).length;
      
      // Fetch orders
      let totalOrders = 0;
      let totalRevenue = 0;
      
      try {
        const ordersResponse = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
        const ordersData = Array.isArray(ordersResponse.data) 
          ? ordersResponse.data 
          : (ordersResponse.data?.orders || []);
        
        totalOrders = ordersData.length;
        
        // Calculate total revenue from paid, shipped, or delivered orders
        const revenueOrders = ordersData.filter(order => 
          order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered'
        );
        
        totalRevenue = revenueOrders.reduce((sum, order) => {
          return sum + (parseFloat(order.total_amount) || 0);
        }, 0);
      } catch (orderError) {
        console.error('Error fetching orders:', orderError);
        // Continue with 0 values if orders fetch fails
      }
      
      // Fetch active deliveries count
      let activeDeliveries = 0;
      try {
        const deliveriesResponse = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
        const deliveriesData = Array.isArray(deliveriesResponse.data) ? deliveriesResponse.data : [];
        activeDeliveries = deliveriesData.filter(j => 
          ['available', 'assigned', 'picked_up', 'delivering'].includes(j.status)
        ).length;
      } catch (deliveryError) {
        console.error('Error fetching deliveries:', deliveryError);
      }

      setStats({
        totalProducts: products.length,
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        lowStockProducts: lowStock,
        activeDeliveries: activeDeliveries,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOperationsManager) {
      return;
    }
    // Refetch stats when threshold changes (but not on initial mount)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (lowStockThreshold > 0) {
      fetchStats();
    }
  }, [isOperationsManager, lowStockThreshold]);

  const handleUpdateThreshold = async () => {
    const newThreshold = parseInt(thresholdInput);
    if (isNaN(newThreshold) || newThreshold < 1) {
      toast.error('Please enter a valid number greater than 0');
      return;
    }

    setUpdatingThreshold(true);
    try {
      await http.put(ADMIN_SETTINGS_ENDPOINTS.UPDATE_LOW_STOCK_THRESHOLD, {
        threshold: newThreshold
      });
      setLowStockThreshold(newThreshold);
      setShowThresholdModal(false);
      toast.success('Low stock threshold updated successfully');
      // Refetch stats with new threshold
      await fetchStats();
    } catch (error) {
      console.error('Error updating threshold:', error);
      toast.error(error.response?.data?.detail || 'Failed to update threshold');
    } finally {
      setUpdatingThreshold(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: '📦',
      color: '#4CAF50',
      path: '/admin/products',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: '📋',
      color: '#2196F3',
      path: '/admin/orders',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: '💰',
      color: '#FF9800',
      path: '/admin/orders?filter=revenue',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockProducts,
      icon: '⚠️',
      color: '#F44336',
      path: '/admin/products?filter=lowstock',
      threshold: lowStockThreshold,
    },
    {
      title: 'Active Deliveries',
      value: stats.activeDeliveries,
      icon: '🚚',
      color: '#9C27B0',
      path: '/admin/deliveries',
    },
  ];

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              if (stat.path) {
                navigate(stat.path);
              }
            }}
            style={{ cursor: stat.path ? 'pointer' : 'default' }}
          >
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20` }}>
              <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
            </div>
            <div className="stat-content">
              <h3>{stat.value}</h3>
              <p>{stat.title}</p>
              {stat.threshold && (
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  Threshold: {'<'} {stat.threshold}
                </p>
              )}
            </div>
            {stat.threshold && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowThresholdModal(true);
                }}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Configure threshold"
              >
                ⚙️
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Threshold Configuration Modal */}
      {showThresholdModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowThresholdModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '0.5rem',
              maxWidth: '400px',
              width: '90%',
            }}
          >
            <h2 style={{ marginBottom: '1rem' }}>Configure Low Stock Threshold</h2>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Set the minimum quantity threshold for low stock alerts. Products with quantity below this value will be marked as low stock.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Threshold Value
              </label>
              <input
                type="number"
                min="1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '0.25rem',
                  fontSize: '1rem',
                }}
                placeholder="Enter threshold"
              />
              <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
                Current threshold: {lowStockThreshold}
              </small>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowThresholdModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '0.25rem',
                  background: 'white',
                  cursor: 'pointer',
                }}
                disabled={updatingThreshold}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateThreshold}
                disabled={updatingThreshold}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '0.25rem',
                  background: '#2196F3',
                  color: 'white',
                  cursor: 'pointer',
                  opacity: updatingThreshold ? 0.6 : 1,
                }}
              >
                {updatingThreshold ? 'Updating...' : 'Update'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="dashboard-actions">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/admin/products" className="dashboard-action-card">
            <h3>Manage Products</h3>
            <p>Add, edit, or delete products</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/admin/promotions" className="dashboard-action-card">
            <h3>Manage Promotions</h3>
            <p>Create rule-based cart and POS discount campaigns</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/admin/categories" className="dashboard-action-card">
            <h3>Manage Categories</h3>
            <p>Organize your product categories</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/admin/orders" className="dashboard-action-card">
            <h3>View Orders</h3>
            <p>Monitor customer orders</p>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch products
      const productsResponse = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const products = productsResponse.data;
      
      const lowStock = products.filter(p => p.quantity < 10).length;
      
      setStats({
        totalProducts: products.length,
        totalOrders: 0, // Placeholder - implement when orders endpoint is available
        totalRevenue: 0, // Placeholder - implement when orders endpoint is available
        lowStockProducts: lowStock,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: '📋',
      color: '#2196F3',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: '💰',
      color: '#FF9800',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockProducts,
      icon: '⚠️',
      color: '#F44336',
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
          >
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20` }}>
              <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
            </div>
            <div className="stat-content">
              <h3>{stat.value}</h3>
              <p>{stat.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

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

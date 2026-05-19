import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, SELLER_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/seller/SellerDashboard.css';

const SellerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    discountedProducts: 0,
    incomingOrders: 0,
    preparingOrders: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch threshold
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
        setLowStockThreshold(threshold);
      } catch (e) { /* use default */ }

      // Fetch products
      const productsRes = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const products = productsRes.data;

      const lowStock = products.filter((p) => p.quantity > 0 && p.quantity < threshold);
      const outOfStock = products.filter((p) => p.quantity === 0);
      const discounted = products.filter((p) => p.discount_enabled);

      setLowStockItems(lowStock.slice(0, 8));

      // Fetch seller orders
      let incomingOrders = 0;
      let preparingOrders = 0;
      try {
        const ordersRes = await http.get(SELLER_ENDPOINTS.ORDERS);
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        incomingOrders = orders.filter((o) => o.status === 'paid').length;
        preparingOrders = orders.filter((o) => o.status === 'preparing').length;
      } catch (e) { /* ignore */ }

      setStats({
        totalProducts: products.length,
        discountedProducts: discounted.length,
        incomingOrders,
        preparingOrders,
        lowStockProducts: lowStock.length,
        outOfStockProducts: outOfStock.length,
      });
    } catch (error) {
      console.error('Error fetching seller dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="seller-dashboard-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Products', value: stats.totalProducts, icon: '📦', color: '#6366f1', path: '/seller/products' },
    { title: 'Active Discounts', value: stats.discountedProducts, icon: '🏷️', color: '#8b5cf6', path: '/seller/products' },
    { title: 'Incoming Orders', value: stats.incomingOrders, icon: '🔔', color: '#f59e0b', path: '/seller/orders' },
    { title: 'Preparing', value: stats.preparingOrders, icon: '⏳', color: '#3b82f6', path: '/seller/orders' },
    { title: 'Low Stock', value: stats.lowStockProducts, icon: '⚠️', color: '#ef4444', path: '/seller/products' },
    { title: 'Out of Stock', value: stats.outOfStockProducts, icon: '🚫', color: '#dc2626', path: '/seller/products' },
  ];

  return (
    <div className="seller-dashboard">
      <h1>Seller Dashboard</h1>

      <div className="seller-stats-grid">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            className="seller-stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate(stat.path)}
          >
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}18` }}>
              <span>{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.title}</div>
          </motion.div>
        ))}
      </div>

      <div className="seller-actions-grid">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link to="/seller/products" className="seller-action-card">
            <h3>📦 Manage Products</h3>
            <p>Add, edit, or remove products from your catalog</p>
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link to="/seller/orders" className="seller-action-card">
            <h3>📋 View Orders</h3>
            <p>Check incoming paid orders and start preparation</p>
          </Link>
        </motion.div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="seller-notifications">
          <h2>⚠️ Low Stock Alerts (below {lowStockThreshold} units)</h2>
          {lowStockItems.map((item) => (
            <div key={item.id} className={`seller-notification-item ${item.quantity === 0 ? 'warning' : 'info'}`}>
              <span className="notif-icon">{item.quantity === 0 ? '🚫' : '⚠️'}</span>
              <div className="notif-content">
                <div className="notif-title">{item.name}</div>
                <div className="notif-desc">
                  {item.quantity === 0
                    ? 'Out of stock — contact warehouse manager'
                    : `Only ${item.quantity} unit${item.quantity !== 1 ? 's' : ''} remaining`
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lowStockItems.length === 0 && stats.totalProducts > 0 && (
        <div className="seller-notifications">
          <h2>✅ Stock Status</h2>
          <div className="seller-notification-item info">
            <span className="notif-icon">👍</span>
            <div className="notif-content">
              <div className="notif-title">All products are well stocked</div>
              <div className="notif-desc">No products below the {lowStockThreshold}-unit threshold</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;

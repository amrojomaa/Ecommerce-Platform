import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, WAREHOUSE_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/warehouse-manager/WarehouseManagerDashboard.css';

const WarehouseManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, outOfStock: 0, packedQueue: 0, openIssues: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
      } catch (e) { /* default */ }

      const [productsRes, packedRes, issuesRes] = await Promise.all([
        http.get(PRODUCT_ENDPOINTS.ALL_ADMIN),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW),
        http.get(WAREHOUSE_ENDPOINTS.ALL_ISSUES + '?status_filter=open'),
      ]);

      const products = productsRes.data;
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];
      const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];

      setStats({
        totalProducts: products.length,
        lowStock: products.filter(p => p.quantity > 0 && p.quantity < threshold).length,
        outOfStock: products.filter(p => p.quantity === 0).length,
        packedQueue: packed.length,
        openIssues: issues.length,
      });
    } catch (error) {
      console.error('Error fetching warehouse manager data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="page-loading wm-dashboard-loading"><LoadingSpinner size="large" /></div>;
  }

  const wmDashTitle = 'Warehouse Manager Dashboard';

  const statCards = [
    { title: 'Total Products', value: stats.totalProducts, icon: '📦', color: '#0ea5e9', path: '/warehouse/inventory' },
    { title: 'Low Stock', value: stats.lowStock, icon: '⚠️', color: '#f59e0b', path: '/warehouse/inventory' },
    { title: 'Out of Stock', value: stats.outOfStock, icon: '🚫', color: '#ef4444', path: '/warehouse/inventory' },
    { title: 'Awaiting Approval', value: stats.packedQueue, icon: '✅', color: '#16a34a', path: '/warehouse/approvals' },
    { title: 'Open Issues', value: stats.openIssues, icon: '🔴', color: '#dc2626', path: '/warehouse/issues' },
  ];

  return (
    <div className="admin-page-shell wm-dashboard">
      <PageHeader kicker={wmDashTitle} title={wmDashTitle} />
      <div className="wm-stats-grid">
        {statCards.map((stat, i) => (
          <motion.div key={stat.title} className="wm-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} whileHover={{ scale: 1.03 }} onClick={() => navigate(stat.path)}>
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}18` }}><span>{stat.icon}</span></div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.title}</div>
          </motion.div>
        ))}
      </div>
      <div className="wm-actions-grid">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link to="/warehouse/inventory" className="wm-action-card"><h3>📦 Inventory Control</h3><p>Monitor stock levels and adjust quantities</p></Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link to="/warehouse/approvals" className="wm-action-card"><h3>✅ Order Approvals</h3><p>Review packed orders and release for pickup</p></Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link to="/warehouse/issues" className="wm-action-card"><h3>⚠️ Issues</h3><p>Resolve missing or damaged item reports</p></Link>
        </motion.div>
      </div>
    </div>
  );
};

export default WarehouseManagerDashboard;

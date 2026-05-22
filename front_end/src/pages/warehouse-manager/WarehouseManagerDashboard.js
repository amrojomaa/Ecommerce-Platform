import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiAlertTriangle, FiCheckCircle, FiPackage, FiSlash, FiTrendingDown } from 'react-icons/fi';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, WAREHOUSE_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';

const WarehouseManagerDashboard = () => {
  const { t } = useTranslation();
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
    return <div className="page-loading wm-page-loading"><LoadingSpinner size="large" /></div>;
  }

  const statCards = [
    { key: 'totalProducts', title: t('ui.pages.warehouse.warehouseDashboard.stat.totalProducts'), value: stats.totalProducts, icon: FiPackage, iconClass: 'wm-stat-icon--products', path: '/warehouse/inventory' },
    { key: 'lowStock', title: t('ui.pages.warehouse.warehouseDashboard.stat.lowStock'), value: stats.lowStock, icon: FiTrendingDown, iconClass: 'wm-stat-icon--low', path: '/warehouse/inventory?stock=low' },
    { key: 'outOfStock', title: t('ui.pages.warehouse.warehouseDashboard.stat.outOfStock'), value: stats.outOfStock, icon: FiSlash, iconClass: 'wm-stat-icon--out', path: '/warehouse/inventory?stock=out' },
    { key: 'awaitingApproval', title: t('ui.pages.warehouse.warehouseDashboard.stat.awaitingApproval'), value: stats.packedQueue, icon: FiCheckCircle, iconClass: 'wm-stat-icon--approval', path: '/warehouse/approvals' },
    { key: 'openIssues', title: t('ui.pages.warehouse.warehouseDashboard.stat.openIssues'), value: stats.openIssues, icon: FiAlertTriangle, iconClass: 'wm-stat-icon--issues', path: '/warehouse/issues' },
  ];

  const actionCards = [
    { path: '/warehouse/inventory', icon: FiPackage, iconClass: '', title: t('ui.pages.warehouse.warehouseDashboard.action.inventory.title'), desc: t('ui.pages.warehouse.warehouseDashboard.action.inventory.desc') },
    { path: '/warehouse/approvals', icon: FiCheckCircle, iconClass: 'wm-action-card-icon--approval', title: t('ui.pages.warehouse.warehouseDashboard.action.approvals.title'), desc: t('ui.pages.warehouse.warehouseDashboard.action.approvals.desc') },
    { path: '/warehouse/issues', icon: FiAlertTriangle, iconClass: 'wm-action-card-icon--issues', title: t('ui.pages.warehouse.warehouseDashboard.action.issues.title'), desc: t('ui.pages.warehouse.warehouseDashboard.action.issues.desc') },
  ];

  return (
    <div className="admin-page-shell wm-page wm-dashboard">
      <PageHeader
        kicker={t('ui.sidebar.panel.warehouse')}
        title={t('ui.pages.warehouse.warehouseDashboard.title')}
        subtitle={t('ui.pages.warehouse.warehouseDashboard.subtitle')}
      />

      <section className="wm-section">
        <div className="wm-section-header">
          <h2>{t('ui.pages.warehouse.warehouseDashboard.section.overview')}</h2>
        </div>
        <div className="wm-stats-grid">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                className="wm-stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => navigate(stat.path)}
              >
                <div className="stat-top">
                  <div className="stat-main">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.title}</div>
                  </div>
                  <div className={`stat-icon ${stat.iconClass}`}><Icon aria-hidden /></div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="wm-section">
        <div className="wm-section-header">
          <h2>{t('ui.pages.warehouse.warehouseDashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.warehouse.warehouseDashboard.section.quickActionsDesc')}</p>
        </div>
        <div className="wm-actions-grid">
          {actionCards.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.path} className="wm-action-card-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link to={action.path} className="wm-action-card">
                  <div className={`wm-action-card-icon ${action.iconClass}`.trim()}><Icon aria-hidden /></div>
                  <div className="wm-action-card-body">
                    <h3>{action.title}</h3>
                    <p>{action.desc}</p>
                  </div>
                  <FaArrowRight className="wm-action-card-arrow" aria-hidden />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default WarehouseManagerDashboard;

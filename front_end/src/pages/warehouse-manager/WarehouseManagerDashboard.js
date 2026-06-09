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
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseManagerDashboard.css';

const WarehouseManagerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.warehouse');

  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    packedQueue: 0,
    openIssues: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
        setLowStockThreshold(threshold);
      } catch (e) {
        /* use default */
      }

      const [statsRes, alertsRes, packedRes, issuesRes] = await Promise.all([
        http.get(PRODUCT_ENDPOINTS.ADMIN_STATS, { params: { threshold } }),
        http.get(PRODUCT_ENDPOINTS.STOCK_ALERTS, { params: { threshold, limit: 8 } }),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW),
        http.get(`${WAREHOUSE_ENDPOINTS.ALL_ISSUES}?status_filter=open`),
      ]);

      const productStats = statsRes.data || {};
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];
      const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];

      setLowStockItems(Array.isArray(alertsRes.data) ? alertsRes.data : []);

      setStats({
        totalProducts: productStats.total ?? 0,
        lowStock: productStats.low_stock ?? 0,
        outOfStock: productStats.out_of_stock ?? 0,
        packedQueue: packed.length,
        openIssues: issues.length,
      });
    } catch (error) {
      console.error('Error fetching warehouse manager data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    {
      key: 'totalProducts',
      title: t('ui.pages.warehouse.warehouseDashboard.stat.totalProducts'),
      value: stats.totalProducts,
      icon: FiPackage,
      iconClass: 'adm-stat-icon--products',
      path: '/warehouse/inventory',
    },
    {
      key: 'lowStock',
      title: t('ui.pages.warehouse.warehouseDashboard.stat.lowStock'),
      value: stats.lowStock,
      icon: FiTrendingDown,
      iconClass: 'adm-stat-icon--revenue',
      path: '/warehouse/inventory?stock=low',
      threshold: lowStockThreshold,
    },
    {
      key: 'outOfStock',
      title: t('ui.pages.warehouse.warehouseDashboard.stat.outOfStock'),
      value: stats.outOfStock,
      icon: FiSlash,
      iconClass: 'adm-stat-icon--low',
      path: '/warehouse/inventory?stock=out',
    },
    {
      key: 'awaitingApproval',
      title: t('ui.pages.warehouse.warehouseDashboard.stat.awaitingApproval'),
      value: stats.packedQueue,
      icon: FiCheckCircle,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/warehouse/approvals',
    },
    {
      key: 'openIssues',
      title: t('ui.pages.warehouse.warehouseDashboard.stat.openIssues'),
      value: stats.openIssues,
      icon: FiAlertTriangle,
      iconClass: 'adm-stat-icon--low',
      path: '/warehouse/issues',
    },
  ];

  const actionCards = [
    {
      path: '/warehouse/inventory',
      icon: FiPackage,
      iconClass: '',
      title: t('ui.pages.warehouse.warehouseDashboard.action.inventory.title'),
      desc: t('ui.pages.warehouse.warehouseDashboard.action.inventory.desc'),
    },
    {
      path: '/warehouse/approvals',
      icon: FiCheckCircle,
      iconClass: 'adm-action-card-icon--categories',
      title: t('ui.pages.warehouse.warehouseDashboard.action.approvals.title'),
      desc: t('ui.pages.warehouse.warehouseDashboard.action.approvals.desc'),
    },
    {
      path: '/warehouse/issues',
      icon: FiAlertTriangle,
      iconClass: 'adm-action-card-icon--promotions',
      title: t('ui.pages.warehouse.warehouseDashboard.action.issues.title'),
      desc: t('ui.pages.warehouse.warehouseDashboard.action.issues.desc'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page adm-dashboard wm-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.warehouse.warehouseDashboard.title')}
        subtitle={t('ui.pages.warehouse.warehouseDashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.warehouse.warehouseDashboard.section.overview')}</h2>
        </div>
        <div className="adm-stats-grid">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                className="adm-stat-card"
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
                    {stat.threshold != null && (
                      <p className="adm-stat-meta">
                        {t('ui.pages.warehouse.warehouseDashboard.thresholdLabel')} {'<'} {stat.threshold}
                      </p>
                    )}
                  </div>
                  <div className={`stat-icon ${stat.iconClass}`}>
                    <Icon aria-hidden />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.warehouse.warehouseDashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.warehouse.warehouseDashboard.section.quickActionsDesc')}</p>
        </div>
        <div className="adm-actions-grid">
          {actionCards.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.path}
                className="adm-action-card-wrap"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Link to={action.path} className="adm-action-card">
                  <div className={`adm-action-card-icon ${action.iconClass}`.trim()}>
                    <Icon aria-hidden />
                  </div>
                  <div className="adm-action-card-body">
                    <h3>{action.title}</h3>
                    <p>{action.desc}</p>
                  </div>
                  <FaArrowRight className="adm-action-card-arrow" aria-hidden />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {(lowStockItems.length > 0 || stats.totalProducts > 0) && (
        <section className="adm-section wm-alerts-section">
          <div className="adm-section-header">
            <h2>{t('ui.pages.warehouse.warehouseDashboard.section.stockAlerts')}</h2>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="wm-alert-list">
              {lowStockItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`wm-alert-item ${item.quantity === 0 ? 'wm-alert-item--critical' : 'wm-alert-item--warn'}`}
                  onClick={() =>
                    navigate(
                      item.quantity === 0
                        ? '/warehouse/inventory?stock=out'
                        : '/warehouse/inventory?stock=low'
                    )
                  }
                >
                  <div className="wm-alert-copy">
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity === 0
                        ? t('ui.pages.warehouse.warehouseDashboard.stock.outOfStock')
                        : t('ui.pages.warehouse.warehouseDashboard.stock.lowRemaining', {
                            count: item.quantity,
                          })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="wm-alert-item wm-alert-item--ok">
              <div className="wm-alert-copy">
                <strong>{t('ui.pages.warehouse.warehouseDashboard.stock.allGood')}</strong>
                <span>
                  {t('ui.pages.warehouse.warehouseDashboard.stock.allGoodDesc', {
                    count: lowStockThreshold,
                  })}
                </span>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default WarehouseManagerDashboard;

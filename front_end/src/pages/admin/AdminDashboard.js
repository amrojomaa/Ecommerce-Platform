import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaArrowRight } from 'react-icons/fa';
import {
  FiBarChart2,
  FiClipboard,
  FiDollarSign,
  FiGrid,
  FiPackage,
  FiSettings,
  FiTag,
  FiTrendingDown,
  FiTruck,
} from 'react-icons/fi';
import http from '../../services/http';
import {
  PRODUCT_ENDPOINTS,
  ORDER_ENDPOINTS,
  ADMIN_SETTINGS_ENDPOINTS,
  DELIVERY_ENDPOINTS,
} from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { filterOrdersByStatus } from '../../utils/orderStatuses';
import '../../styles/pages/admin/AdminPanel.css';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const panelKicker = t('ui.sidebar.panel.admin');

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

  const fetchLowStockThreshold = useCallback(async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      const threshold = response.data.threshold;
      setLowStockThreshold(threshold);
      setThresholdInput(threshold.toString());
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      setLowStockThreshold(10);
      setThresholdInput('10');
      return 10;
    }
  }, []);

  const fetchStats = useCallback(
    async (thresholdOverride = null) => {
      const effectiveThreshold = Number.isFinite(Number(thresholdOverride))
        ? Number(thresholdOverride)
        : Number(lowStockThreshold);
      setLoading(true);
      try {
        let totalProductsCount = 0;
        let lowStock = 0;
        try {
          const productsResponse = await http.get(PRODUCT_ENDPOINTS.ADMIN_STATS, {
            params: { threshold: effectiveThreshold },
          });
          totalProductsCount = productsResponse.data?.total ?? 0;
          lowStock = productsResponse.data?.low_stock ?? 0;
        } catch (productError) {
          console.error('Error fetching product stats:', productError);
        }

        let totalOrders = 0;
        let totalRevenue = 0;
        try {
          const ordersResponse = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
          const ordersData = Array.isArray(ordersResponse.data)
            ? ordersResponse.data
            : ordersResponse.data?.orders || [];
          totalOrders = ordersData.length;
          const revenueOrders = filterOrdersByStatus(ordersData, 'revenue');
          totalRevenue = revenueOrders.reduce(
            (sum, order) => sum + (parseFloat(order.total_amount) || 0),
            0
          );
        } catch (orderError) {
          console.error('Error fetching orders:', orderError);
        }

        let activeDeliveries = 0;
        try {
          const deliveriesResponse = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
          const deliveriesData = Array.isArray(deliveriesResponse.data)
            ? deliveriesResponse.data
            : [];
          activeDeliveries = deliveriesData.filter((j) =>
            ['available', 'assigned', 'picked_up', 'delivering'].includes(j.status)
          ).length;
        } catch (deliveryError) {
          console.error('Error fetching deliveries:', deliveryError);
        }

        setStats({
          totalProducts: totalProductsCount,
          totalOrders,
          totalRevenue,
          lowStockProducts: lowStock,
          activeDeliveries,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    },
    [lowStockThreshold]
  );

  useEffect(() => {
    const initializeData = async () => {
      const threshold = await fetchLowStockThreshold();
      await fetchStats(threshold);
    };
    initializeData();
  }, [fetchLowStockThreshold, fetchStats]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (lowStockThreshold > 0) {
      fetchStats();
    }
  }, [lowStockThreshold, fetchStats]);

  const handleUpdateThreshold = async () => {
    const newThreshold = parseInt(thresholdInput, 10);
    if (Number.isNaN(newThreshold) || newThreshold < 1) {
      toast.error(t('ui.pages.admin.adminDashboard.pleaseEnterAValidNumber_13831328c9'));
      return;
    }

    setUpdatingThreshold(true);
    try {
      await http.put(ADMIN_SETTINGS_ENDPOINTS.UPDATE_LOW_STOCK_THRESHOLD, {
        threshold: newThreshold,
      });
      setLowStockThreshold(newThreshold);
      setShowThresholdModal(false);
      toast.success(t('ui.pages.admin.adminDashboard.lowStockThresholdUpdatedSuccessfully_131aa1d046'));
      await fetchStats(newThreshold);
    } catch (error) {
      console.error('Error updating threshold:', error);
      toast.error(error.response?.data?.detail || 'Failed to update threshold');
    } finally {
      setUpdatingThreshold(false);
    }
  };

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
      title: t('ui.pages.admin.adminDashboard.totalProducts_d457551dae'),
      value: stats.totalProducts,
      icon: FiPackage,
      iconClass: 'adm-stat-icon--products',
      path: '/admin/products',
    },
    {
      key: 'totalOrders',
      title: t('ui.pages.admin.adminDashboard.totalOrders_3968b1aea2'),
      value: stats.totalOrders,
      icon: FiClipboard,
      iconClass: 'adm-stat-icon--orders',
      path: '/admin/orders',
    },
    {
      key: 'totalRevenue',
      title: t('ui.pages.admin.adminDashboard.totalRevenue_8625d01bf6'),
      value: formatCurrency(stats.totalRevenue),
      icon: FiDollarSign,
      iconClass: 'adm-stat-icon--revenue',
      path: '/admin/orders?filter=revenue',
    },
    {
      key: 'lowStock',
      title: t('ui.pages.admin.adminDashboard.lowStockItems_5d20c43c41'),
      value: stats.lowStockProducts,
      icon: FiTrendingDown,
      iconClass: 'adm-stat-icon--low',
      path: '/admin/products?filter=lowstock',
      threshold: lowStockThreshold,
    },
    {
      key: 'activeDeliveries',
      title: t('ui.pages.admin.adminDashboard.activeDeliveries_88b2551152'),
      value: stats.activeDeliveries,
      icon: FiTruck,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/admin/deliveries',
    },
  ];

  const actionCards = [
    {
      path: '/admin/products',
      icon: FiPackage,
      iconClass: '',
      title: t('ui.pages.admin.adminDashboard.manageProducts_f61663679a'),
      desc: t('ui.pages.admin.adminDashboard.addEditOrDeleteProducts_e0122eec91'),
    },
    {
      path: '/admin/promotions',
      icon: FiTag,
      iconClass: 'adm-action-card-icon--promotions',
      title: t('ui.pages.admin.adminDashboard.managePromotions_48a31a922f'),
      desc: t('ui.pages.admin.adminDashboard.createRuleBasedCartAnd_1861c140e1'),
    },
    {
      path: '/admin/categories',
      icon: FiGrid,
      iconClass: 'adm-action-card-icon--categories',
      title: t('ui.pages.admin.adminDashboard.manageCategories_ca9b3bad2a'),
      desc: t('ui.pages.admin.adminDashboard.organizeYourProductCategories_4e86f7c153'),
    },
    {
      path: '/admin/orders',
      icon: FiClipboard,
      iconClass: 'adm-action-card-icon--orders',
      title: t('ui.pages.admin.adminDashboard.viewOrders_9d4d2887cf'),
      desc: t('ui.pages.admin.adminDashboard.monitorCustomerOrders_026e4ad4df'),
    },
    {
      path: '/admin/deliveries',
      icon: FiTruck,
      iconClass: 'adm-action-card-icon--deliveries',
      title: t('ui.pages.admin.adminDashboard.action.deliveries.title'),
      desc: t('ui.pages.admin.adminDashboard.action.deliveries.desc'),
    },
    {
      path: '/admin/pos-analytics',
      icon: FiBarChart2,
      iconClass: 'adm-action-card-icon--pos',
      title: t('ui.pages.admin.adminDashboard.action.posAnalytics.title'),
      desc: t('ui.pages.admin.adminDashboard.action.posAnalytics.desc'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page adm-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.admin.adminDashboard.adminDashboard_16654f6473')}
        subtitle={t('ui.pages.admin.adminDashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.admin.adminDashboard.section.overview')}</h2>
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
                onClick={() => stat.path && navigate(stat.path)}
              >
                {stat.threshold != null && (
                  <button
                    type="button"
                    className="adm-stat-config-btn"
                    title={t('ui.pages.admin.adminDashboard.configureThreshold_6c49d82303')}
                    aria-label={t('ui.pages.admin.adminDashboard.configureThreshold_6c49d82303')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowThresholdModal(true);
                    }}
                  >
                    <FiSettings aria-hidden />
                  </button>
                )}
                <div className="stat-top">
                  <div className="stat-main">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.title}</div>
                    {stat.threshold != null && (
                      <p className="adm-stat-meta">
                        {t('ui.pages.admin.adminDashboard.threshold_5e08be5809')}{' '}
                        {'<'} {stat.threshold}
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
          <h2>{t('ui.pages.admin.adminDashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.admin.adminDashboard.section.quickActionsDesc')}</p>
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

      {showThresholdModal && (
        <motion.div
          className="admin-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowThresholdModal(false)}
        >
          <motion.div
            className="admin-modal"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="adm-threshold-title"
          >
            <h2 id="adm-threshold-title">
              {t('ui.pages.admin.adminDashboard.configureLowStockThreshold_22dcb80c15')}
            </h2>
            <p className="adm-modal-desc">
              {t('ui.pages.admin.adminDashboard.setTheMinimumQuantityThreshold_fe35c5b475')}
            </p>
            <div className="adm-modal-field">
              <label htmlFor="adm-threshold-input">
                {t('ui.pages.admin.adminDashboard.thresholdValue_71a139a7b5')}
              </label>
              <input
                id="adm-threshold-input"
                type="number"
                min="1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                placeholder={t('ui.pages.admin.adminDashboard.enterThreshold_219f1692b7')}
              />
              <small className="adm-modal-hint">
                {t('ui.pages.admin.adminDashboard.currentThreshold_4fa4cc319c')}{' '}
                {lowStockThreshold}
              </small>
            </div>
            <div className="adm-modal-actions">
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => setShowThresholdModal(false)}
                disabled={updatingThreshold}
              >
                {t('ui.pages.admin.adminDashboard.cancel_a89615662d')}
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                onClick={handleUpdateThreshold}
                disabled={updatingThreshold}
              >
                {updatingThreshold
                  ? t('ui.pages.admin.adminDashboard.updating_6f3aa97175')
                  : t('ui.pages.admin.adminDashboard.update_9caf0051b0')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminDashboard;


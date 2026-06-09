import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import {
  FiClipboard,
  FiClock,
  FiPackage,
  FiTag,
  FiTrendingDown,
  FiXCircle,
} from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, SELLER_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/seller/SellerPanel.css';
import '../../styles/pages/seller/SellerDashboard.css';

const SellerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.seller');

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
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
        setLowStockThreshold(threshold);
      } catch (e) {
        /* use default */
      }

      const [statsRes, alertsRes] = await Promise.all([
        http.get(PRODUCT_ENDPOINTS.ADMIN_STATS, { params: { threshold } }),
        http.get(PRODUCT_ENDPOINTS.STOCK_ALERTS, { params: { threshold, limit: 8 } }),
      ]);
      const productStats = statsRes.data || {};

      setLowStockItems(Array.isArray(alertsRes.data) ? alertsRes.data : []);

      let incomingOrders = 0;
      let preparingOrders = 0;
      try {
        const ordersRes = await http.get(SELLER_ENDPOINTS.ORDERS);
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        incomingOrders = orders.filter((o) => o.status === 'paid').length;
        preparingOrders = orders.filter((o) => o.status === 'preparing').length;
      } catch (e) {
        /* ignore */
      }

      setStats({
        totalProducts: productStats.total ?? 0,
        discountedProducts: productStats.discounted ?? 0,
        incomingOrders,
        preparingOrders,
        lowStockProducts: productStats.low_stock ?? 0,
        outOfStockProducts: productStats.out_of_stock ?? 0,
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
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    {
      key: 'totalProducts',
      title: tUi('ui.pages.seller.sellerDashboard.statTotalProducts_a1b2c3d4e5'),
      value: stats.totalProducts,
      icon: FiPackage,
      iconClass: 'adm-stat-icon--products',
      path: '/seller/products',
    },
    {
      key: 'discounted',
      title: tUi('ui.pages.seller.sellerDashboard.statActiveDiscounts_f6g7h8i9j0'),
      value: stats.discountedProducts,
      icon: FiTag,
      iconClass: 'adm-action-card-icon--promotions',
      path: '/seller/products',
    },
    {
      key: 'incoming',
      title: tUi('ui.pages.seller.sellerDashboard.statIncomingOrders_k1l2m3n4o5'),
      value: stats.incomingOrders,
      icon: FiClipboard,
      iconClass: 'adm-stat-icon--orders',
      path: '/seller/orders',
      statusFilter: 'paid',
    },
    {
      key: 'preparing',
      title: tUi('ui.pages.seller.sellerDashboard.statPreparing_p5q6r7s8t9'),
      value: stats.preparingOrders,
      icon: FiClock,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/seller/orders',
      statusFilter: 'preparing',
    },
    {
      key: 'lowStock',
      title: tUi('ui.pages.seller.sellerDashboard.statLowStock_u1v2w3x4y5'),
      value: stats.lowStockProducts,
      icon: FiTrendingDown,
      iconClass: 'adm-stat-icon--low',
      path: '/seller/products',
      threshold: lowStockThreshold,
    },
    {
      key: 'outOfStock',
      title: tUi('ui.pages.seller.sellerDashboard.statOutOfStock_z6a7b8c9d0'),
      value: stats.outOfStockProducts,
      icon: FiXCircle,
      iconClass: 'adm-stat-icon--low',
      path: '/seller/products',
    },
  ];

  const actionCards = [
    {
      path: '/seller/products',
      icon: FiPackage,
      iconClass: '',
      title: tUi('ui.pages.seller.sellerDashboard.actionProductsTitle_e1f2g3h4i5'),
      desc: tUi('ui.pages.seller.sellerDashboard.actionProductsDesc_j6k7l8m9n0'),
    },
    {
      path: '/seller/orders',
      icon: FiClipboard,
      iconClass: 'adm-action-card-icon--orders',
      title: tUi('ui.pages.seller.sellerDashboard.actionOrdersTitle_o1p2q3r4s5'),
      desc: tUi('ui.pages.seller.sellerDashboard.actionOrdersDesc_t6u7v8w9x0'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page adm-dashboard slr-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.seller.sellerDashboard.title_y1z2a3b4c5')}
        subtitle={tUi('ui.pages.seller.sellerDashboard.subtitle_d5e6f7g8h9')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{tUi('ui.pages.seller.sellerDashboard.sectionOverview_i0j1k2l3m4')}</h2>
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
                onClick={() => {
                  if (!stat.path) return;
                  if (stat.statusFilter) {
                    navigate(`${stat.path}?filter=${stat.statusFilter}`);
                    return;
                  }
                  navigate(stat.path);
                }}
              >
                <div className="stat-top">
                  <div className="stat-main">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.title}</div>
                    {stat.threshold != null && (
                      <p className="adm-stat-meta">
                        {tUi('ui.pages.seller.sellerDashboard.thresholdLabel_n5o6p7q8r9')} {'<'} {stat.threshold}
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
          <h2>{tUi('ui.pages.seller.sellerDashboard.sectionQuickActions_s0t1u2v3w4')}</h2>
          <p>{tUi('ui.pages.seller.sellerDashboard.sectionQuickActionsDesc_x5y6z7a8b9')}</p>
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
        <section className="adm-section slr-alerts-section">
          <div className="adm-section-header">
            <h2>{tUi('ui.pages.seller.sellerDashboard.sectionStockAlerts_c0d1e2f3g4')}</h2>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="slr-alert-list">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className={`slr-alert-item ${item.quantity === 0 ? 'slr-alert-item--critical' : 'slr-alert-item--warn'}`}
                >
                  <div className="slr-alert-copy">
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity === 0
                        ? tUi('ui.pages.seller.sellerDashboard.stockOutOfStock_h5i6j7k8l9')
                        : tUi('ui.pages.seller.sellerDashboard.stockLowRemaining_m0n1o2p3q4', {
                            value0: item.quantity,
                          })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="slr-alert-item slr-alert-item--ok">
              <div className="slr-alert-copy">
                <strong>{tUi('ui.pages.seller.sellerDashboard.stockAllGood_r5s6t7u8v9')}</strong>
                <span>
                  {tUi('ui.pages.seller.sellerDashboard.stockAllGoodDesc_w0x1y2z3a4', {
                    value0: lowStockThreshold,
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

export default SellerDashboard;

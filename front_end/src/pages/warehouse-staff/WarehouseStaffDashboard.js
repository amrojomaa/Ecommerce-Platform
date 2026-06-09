import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiCheckCircle, FiClipboard, FiPackage, FiTrendingDown, FiXCircle } from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, PRODUCT_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffDashboard.css';

const WarehouseStaffDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.warehouseStaff');

  const [stats, setStats] = useState({
    preparingCount: 0,
    packedCount: 0,
    totalProducts: 0,
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

      const [prepRes, packedRes, statsRes, alertsRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
        http.get(PRODUCT_ENDPOINTS.ADMIN_STATS, { params: { threshold } }),
        http.get(PRODUCT_ENDPOINTS.STOCK_ALERTS, { params: { threshold, limit: 8 } }),
      ]);

      const preparing = Array.isArray(prepRes.data) ? prepRes.data : [];
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];
      const productStats = statsRes.data || {};

      setLowStockItems(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setStats({
        preparingCount: preparing.length,
        packedCount: packed.length,
        totalProducts: productStats.total ?? 0,
        lowStockProducts: productStats.low_stock ?? 0,
        outOfStockProducts: productStats.out_of_stock ?? 0,
      });
    } catch (error) {
      console.error('Error fetching warehouse staff dashboard data:', error);
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
      key: 'preparing',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statToPack_a1b2c3d4e5'),
      value: stats.preparingCount,
      icon: FiClipboard,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/warehouse-staff/orders',
      statusFilter: 'preparing',
    },
    {
      key: 'packed',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statPacked_f6g7h8i9j0'),
      value: stats.packedCount,
      icon: FiCheckCircle,
      iconClass: 'adm-stat-icon--orders',
      path: '/warehouse-staff/orders',
      statusFilter: 'packed',
    },
    {
      key: 'totalProducts',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statTotalProducts_a0b1c2d3e4'),
      value: stats.totalProducts,
      icon: FiPackage,
      iconClass: 'adm-stat-icon--products',
      path: '/warehouse-staff/products',
    },
    {
      key: 'lowStock',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statLowStock_f5g6h7i8j9'),
      value: stats.lowStockProducts,
      icon: FiTrendingDown,
      iconClass: 'adm-stat-icon--low',
      path: '/warehouse-staff/products',
    },
    {
      key: 'outOfStock',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statOutOfStock_k0l1m2n3o4'),
      value: stats.outOfStockProducts,
      icon: FiXCircle,
      iconClass: 'adm-stat-icon--low',
      path: '/warehouse-staff/products',
    },
  ];

  const actionCards = [
    {
      key: 'products',
      path: '/warehouse-staff/products',
      icon: FiPackage,
      iconClass: 'adm-action-card-icon--products',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionProductsTitle_p5q6r7s8t9'),
      desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionProductsDesc_u0v1w2x3y4'),
    },
    {
      key: 'pack',
      path: '/warehouse-staff/orders',
      filter: 'preparing',
      icon: FiClipboard,
      iconClass: 'adm-action-card-icon--orders',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackTitle_k1l2m3n4o5'),
      desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackDesc_p5q6r7s8t9'),
    },
    {
      key: 'packed',
      path: '/warehouse-staff/orders',
      filter: 'packed',
      icon: FiCheckCircle,
      iconClass: 'adm-action-card-icon--deliveries',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackedTitle_u1v2w3x4y5'),
      desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackedDesc_z6a7b8c9d0'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page adm-dashboard wms-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.title_e1f2g3h4i5')}
        subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.subtitle_j6k7l8m9n0')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionOverview_o1p2q3r4s5')}</h2>
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
                onClick={() =>
                  navigate(
                    stat.statusFilter ? `${stat.path}?filter=${stat.statusFilter}` : stat.path
                  )
                }
              >
                <div className="stat-top">
                  <div className="stat-main">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.title}</div>
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
          <h2>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionQuickActions_t6u7v8w9x0')}</h2>
          <p>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionQuickActionsDesc_y1z2a3b4c5')}</p>
        </div>
        <div className="adm-actions-grid">
          {actionCards.map((action, i) => {
            const Icon = action.icon;
            const to = action.filter ? `${action.path}?filter=${action.filter}` : action.path;
            return (
              <motion.div
                key={action.key}
                className="adm-action-card-wrap"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Link to={to} className="adm-action-card">
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
        <section className="adm-section wms-alerts-section">
          <div className="adm-section-header">
            <h2>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionStockAlerts_z5a6b7c8d9')}</h2>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="wms-alert-list">
              {lowStockItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`wms-alert-item ${item.quantity === 0 ? 'wms-alert-item--critical' : 'wms-alert-item--warn'}`}
                  onClick={() => navigate('/warehouse-staff/products')}
                >
                  <div className="wms-alert-copy">
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity === 0
                        ? tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockOutOfStock_e0f1g2h3i4')
                        : tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockLowRemaining_j5k6l7m8n9', {
                            value0: item.quantity,
                          })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="wms-alert-item wms-alert-item--ok">
              <div className="wms-alert-copy">
                <strong>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockAllGood_o0p1q2r3s4')}</strong>
                <span>
                  {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockAllGoodDesc_t5u6v7w8x9', {
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

export default WarehouseStaffDashboard;

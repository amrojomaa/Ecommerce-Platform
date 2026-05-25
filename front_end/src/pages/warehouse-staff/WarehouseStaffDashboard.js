import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiCheckCircle, FiClipboard, FiPackage } from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffDashboard.css';

const WarehouseStaffDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.warehouseStaff');

  const [stats, setStats] = useState({ preparingCount: 0, packedCount: 0 });
  const [preparingOrders, setPreparingOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prepRes, packedRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
      ]);

      const preparing = Array.isArray(prepRes.data) ? prepRes.data : [];
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];

      setPreparingOrders(preparing.slice(0, 6));
      setStats({
        preparingCount: preparing.length,
        packedCount: packed.length,
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
  ];

  const actionCards = [
    {
      path: '/warehouse-staff/orders',
      filter: 'preparing',
      icon: FiPackage,
      iconClass: 'adm-action-card-icon--orders',
      title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackTitle_k1l2m3n4o5'),
      desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackDesc_p5q6r7s8t9'),
    },
    {
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
                onClick={() => navigate(`${stat.path}?filter=${stat.statusFilter}`)}
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
                key={action.title}
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

      <section className="adm-section wms-queue-section">
        <div className="adm-section-header">
          <h2>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionQueue_d5e6f7g8h9')}</h2>
        </div>
        {preparingOrders.length === 0 ? (
          <div className="adm-page-empty wms-queue-empty">
            <p>{tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.queueEmpty_i0j1k2l3m4')}</p>
          </div>
        ) : (
          <div className="wms-queue-list">
            {preparingOrders.map((order, index) => {
              const orderItems = order.items || order.orderitems || [];
              return (
                <motion.button
                  key={order.id}
                  type="button"
                  className="wms-queue-card"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate('/warehouse-staff/orders?filter=preparing')}
                >
                  <div className="wms-queue-card-top">
                    <span className="wms-queue-order-id">
                      {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.orderLabel_n5o6p7q8r9', {
                        value0: order.id,
                      })}
                    </span>
                    <span className="wms-queue-item-count">
                      {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.itemCount_s0t1u2v3w4', {
                        value0: orderItems.length,
                      })}
                    </span>
                  </div>
                  <span className="wms-queue-meta">{order.user?.email || '—'}</span>
                  <span className="wms-queue-meta">{formatDateTime(order.created_at)}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default WarehouseStaffDashboard;

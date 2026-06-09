import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiClipboard, FiCreditCard, FiDollarSign, FiTruck } from 'react-icons/fi';
import http from '../../services/http';
import {
  ORDER_ENDPOINTS,
  DELIVERY_ENDPOINTS,
  INSTALLMENT_ENDPOINTS,
} from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { REVENUE_ORDER_STATUSES } from '../../utils/orderStatuses';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/OperationsManagerDashboard.css';

const OperationsManagerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const panelKicker = t('ui.sidebar.panel.operations');

  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    activeDeliveries: 0,
    pendingInstallments: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let totalOrders = 0;
      let totalRevenue = 0;
      try {
        const ordersResponse = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
        const ordersData = Array.isArray(ordersResponse.data)
          ? ordersResponse.data
          : ordersResponse.data?.orders || [];
        totalOrders = ordersData.length;
        totalRevenue = ordersData
          .filter((order) =>
            REVENUE_ORDER_STATUSES.includes(String(order.status || '').toLowerCase())
          )
          .reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }

      let activeDeliveries = 0;
      try {
        const deliveriesResponse = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
        const deliveriesData = Array.isArray(deliveriesResponse.data) ? deliveriesResponse.data : [];
        activeDeliveries = deliveriesData.filter((job) =>
          ['available', 'assigned', 'picked_up', 'delivering'].includes(job.status)
        ).length;
      } catch (error) {
        console.error('Error fetching deliveries:', error);
      }

      let pendingInstallments = 0;
      try {
        const installmentsResponse = await http.get(INSTALLMENT_ENDPOINTS.ADMIN_REQUESTS, {
          params: { status_filter: 'pending' },
        });
        const installmentsData = Array.isArray(installmentsResponse.data)
          ? installmentsResponse.data
          : installmentsResponse.data?.requests || [];
        pendingInstallments = installmentsData.filter(
          (request) => String(request.status || '').toLowerCase() === 'pending'
        ).length;
      } catch (error) {
        console.error('Error fetching installments:', error);
      }

      setStats({
        totalOrders,
        totalRevenue,
        activeDeliveries,
        pendingInstallments,
      });
    } catch (error) {
      console.error('Error fetching operations dashboard data:', error);
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
      key: 'totalOrders',
      title: t('ui.pages.admin.operationsManagerDashboard.stat.totalOrders'),
      value: stats.totalOrders,
      icon: FiClipboard,
      iconClass: 'adm-stat-icon--orders',
      path: '/operations/orders',
    },
    {
      key: 'totalRevenue',
      title: t('ui.pages.admin.operationsManagerDashboard.stat.totalRevenue'),
      value: formatCurrency(stats.totalRevenue),
      icon: FiDollarSign,
      iconClass: 'adm-stat-icon--revenue',
      path: '/operations/orders',
    },
    {
      key: 'activeDeliveries',
      title: t('ui.pages.admin.operationsManagerDashboard.stat.activeDeliveries'),
      value: stats.activeDeliveries,
      icon: FiTruck,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/operations/deliveries',
    },
    {
      key: 'pendingInstallments',
      title: t('ui.pages.admin.operationsManagerDashboard.stat.pendingInstallments'),
      value: stats.pendingInstallments,
      icon: FiCreditCard,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/operations/installments',
    },
  ];

  const actionCards = [
    {
      path: '/operations/orders',
      icon: FiClipboard,
      iconClass: 'adm-action-card-icon--orders',
      title: t('ui.pages.admin.operationsManagerDashboard.action.orders.title'),
      desc: t('ui.pages.admin.operationsManagerDashboard.action.orders.desc'),
    },
    {
      path: '/operations/installments',
      icon: FiCreditCard,
      iconClass: 'adm-action-card-icon--promotions',
      title: t('ui.pages.admin.operationsManagerDashboard.action.installments.title'),
      desc: t('ui.pages.admin.operationsManagerDashboard.action.installments.desc'),
    },
    {
      path: '/operations/deliveries',
      icon: FiTruck,
      iconClass: 'adm-action-card-icon--deliveries',
      title: t('ui.pages.admin.operationsManagerDashboard.action.deliveries.title'),
      desc: t('ui.pages.admin.operationsManagerDashboard.action.deliveries.desc'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page adm-dashboard ops-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.admin.operationsManagerDashboard.title')}
        subtitle={t('ui.pages.admin.operationsManagerDashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.admin.operationsManagerDashboard.section.overview')}</h2>
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
          <h2>{t('ui.pages.admin.operationsManagerDashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.admin.operationsManagerDashboard.section.quickActionsDesc')}</p>
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
    </div>
  );
};

export default OperationsManagerDashboard;

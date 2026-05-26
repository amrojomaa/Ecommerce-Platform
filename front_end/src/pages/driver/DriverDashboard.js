import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiClipboard, FiMapPin, FiPackage, FiTruck } from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/driver/DriverPanel.css';
import '../../styles/pages/driver/DriverDashboard.css';

const DriverDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.driver');

  const [activeJobs, setActiveJobs] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, availableRes] = await Promise.all([
        http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS),
        http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS),
      ]);
      setActiveJobs(activeRes.data || []);
      setAvailableCount((availableRes.data || []).length);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
      key: 'active',
      title: tUi('ui.pages.driver.driverDashboard.activeDeliveries_b212236f76'),
      value: activeJobs.length,
      icon: FiTruck,
      iconClass: 'adm-stat-icon--orders',
      path: '/driver/active',
    },
    {
      key: 'available',
      title: tUi('ui.pages.driver.driverDashboard.availableJobs_cc23afe56a'),
      value: availableCount,
      icon: FiPackage,
      iconClass: 'adm-stat-icon--low',
      path: '/driver/map',
    },
  ];

  const actionCards = [
    {
      path: '/driver/map',
      icon: FiMapPin,
      iconClass: 'adm-action-card-icon--orders',
      title: tUi('ui.pages.driver.driverDashboard.findJobs_d0c3b5a149'),
      desc: tUi('ui.pages.driver.driverDashboard.viewAvailableDeliveryRequestsOn_aa9ad5470b'),
    },
    {
      path: '/driver/active',
      icon: FiTruck,
      iconClass: 'adm-action-card-icon--deliveries',
      title: tUi('ui.pages.driver.driverDashboard.activeDelivery_dbf7ad5b46'),
      desc: tUi('ui.pages.driver.driverDashboard.trackAndManageYourCurrent_e78d8342ac'),
    },
    {
      path: '/driver/history',
      icon: FiClipboard,
      iconClass: 'adm-action-card-icon--categories',
      title: tUi('ui.pages.driver.driverDashboard.deliveryHistory_853624d313'),
      desc: tUi('ui.pages.driver.driverDashboard.viewYourCompletedDeliveries_5595c582d7'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page drv-page drv-dashboard adm-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.driver.driverDashboard.driverDashboard_6764ab49f0')}
        subtitle={t('ui.pages.driver.dashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.driver.dashboard.section.overview')}</h2>
        </div>
        <div className="adm-stats-grid">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                className="adm-stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
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
          <h2>{t('ui.pages.driver.dashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.driver.dashboard.section.quickActionsDesc')}</p>
        </div>
        <div className="adm-actions-grid">
          {actionCards.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.path}
                className="adm-action-card-wrap"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
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

export default DriverDashboard;

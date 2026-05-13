import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Sidebar.css';

const DriverSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const menuItems = [
  { path: '/driver', labelKey: 'ui.sidebar.menu.dashboard', icon: '📊' },
  { path: '/driver/map', labelKey: 'ui.sidebar.menu.findJobs', icon: '🗺️' },
  { path: '/driver/active', labelKey: 'ui.sidebar.menu.activeJob', icon: '🚚' },
  { path: '/driver/history', labelKey: 'ui.sidebar.menu.history', icon: '📋' },
  { path: '/driver/earnings', labelKey: 'ui.sidebar.menu.earnings', icon: '💰' }];


  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>{t('ui.sidebar.panel.driver')}</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) =>
        <Link
          key={item.path}
          to={item.path}
          className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}>
          
            <span className="sidebar-icon">{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        )}
      </nav>
    </aside>);

};

export default DriverSidebar;

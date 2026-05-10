import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Sidebar.css';

const CashierSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const menuItems = [{ path: '/cashier', labelKey: 'ui.sidebar.menu.posTerminal', icon: '🧾' }];

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>{t('ui.sidebar.panel.cashier')}</h2>
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

export default CashierSidebar;

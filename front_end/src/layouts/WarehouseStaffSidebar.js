import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/WarehouseStaffLayout.css';
import '../styles/layouts/Sidebar.css';

const WS_MENU_ITEMS = [
  { path: '/warehouse-staff', label: 'Dashboard', icon: '📊' },
  { path: '/warehouse-staff/orders', label: 'Orders', icon: '📋' },
];

const WarehouseStaffSidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Warehouse</h2>
      </div>
      <nav className="sidebar-nav">
        {WS_MENU_ITEMS.map((item) => (
          <div key={item.path} className="sidebar-item-row">
            <Link
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default WarehouseStaffSidebar;

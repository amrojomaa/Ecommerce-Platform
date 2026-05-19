import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/SellerLayout.css';
import '../styles/layouts/Sidebar.css';

const SELLER_MENU_ITEMS = [
  { path: '/seller', label: 'Dashboard', icon: '📊' },
  { path: '/seller/products', label: 'Products', icon: '📦' },
  { path: '/seller/categories', label: 'Categories', icon: '🏷️' },
  { path: '/seller/promotions', label: 'Promotions', icon: '🎟️' },
  { path: '/seller/orders', label: 'Orders', icon: '📋' },
];

const SellerSidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Seller Panel</h2>
      </div>
      <nav className="sidebar-nav">
        {SELLER_MENU_ITEMS.map((item) => (
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

export default SellerSidebar;

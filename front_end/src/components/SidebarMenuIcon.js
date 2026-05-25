import React from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBox,
  FiCheckCircle,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiHeadphones,
  FiLayout,
  FiMessageSquare,
  FiPackage,
  FiPercent,
  FiStar,
  FiTag,
  FiTarget,
  FiTruck,
  FiUsers,
  FiShoppingBag,
} from 'react-icons/fi';

const SIDEBAR_ICON_CONFIG = {
  dashboard: { Icon: FiBarChart2, tone: 'primary' },
  products: { Icon: FiPackage, tone: 'primary' },
  promotions: { Icon: FiTarget, tone: 'amber' },
  discounts: { Icon: FiPercent, tone: 'rose' },
  categories: { Icon: FiGrid, tone: 'green' },
  orders: { Icon: FiClipboard, tone: 'primary' },
  installments: { Icon: FiCreditCard, tone: 'violet' },
  deliveries: { Icon: FiTruck, tone: 'purple' },
  users: { Icon: FiUsers, tone: 'primary' },
  tickets: { Icon: FiMessageSquare, tone: 'amber' },
  reviews: { Icon: FiTag, tone: 'primary' },
  feedback: { Icon: FiStar, tone: 'amber' },
  warehouseInventory: { Icon: FiPackage, tone: 'primary' },
  warehouseApprovals: { Icon: FiCheckCircle, tone: 'green' },
  warehouseIssues: { Icon: FiAlertTriangle, tone: 'amber' },
};

const PANEL_BRAND_CONFIG = {
  admin: { Icon: FiLayout, tone: 'primary' },
  operations: { Icon: FiActivity, tone: 'amber' },
  support: { Icon: FiHeadphones, tone: 'primary' },
  warehouse: { Icon: FiBox, tone: 'green' },
  seller: { Icon: FiShoppingBag, tone: 'amber' },
};

export const SidebarMenuIcon = ({ name, className = '' }) => {
  const config = SIDEBAR_ICON_CONFIG[name];
  if (!config) {
    return null;
  }

  const { Icon, tone } = config;

  return (
    <span className={`sidebar-icon-box sidebar-icon-box--${tone} ${className}`.trim()} aria-hidden>
      <Icon className="sidebar-icon-glyph" />
    </span>
  );
};

export const SidebarPanelBrandIcon = ({ panelKey, className = '' }) => {
  const config = PANEL_BRAND_CONFIG[panelKey] || PANEL_BRAND_CONFIG.admin;
  const { Icon, tone } = config;

  return (
    <span className={`sidebar-brand-icon sidebar-icon-box sidebar-icon-box--${tone} ${className}`.trim()} aria-hidden>
      <Icon className="sidebar-icon-glyph sidebar-brand-glyph" />
    </span>
  );
};

export default SidebarMenuIcon;

import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SupportManagerDashboardScreen from '../screens/SupportManagerDashboardScreen';
import SupportAgentDashboardScreen from '../screens/SupportAgentDashboardScreen';
import WarehouseManagerDashboardScreen from '../screens/WarehouseManagerDashboardScreen';
import WarehouseStaffDashboardScreen from '../screens/WarehouseStaffDashboardScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import AdminCategoriesScreen from '../screens/AdminCategoriesScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminTicketsScreen from '../screens/AdminTicketsScreen';
import SupportAgentTicketsScreen from '../screens/SupportAgentTicketsScreen';
import SupportAgentChatsScreen from '../screens/SupportAgentChatsScreen';
import WarehouseInventoryScreen from '../screens/WarehouseInventoryScreen';
import WarehouseApprovalsScreen from '../screens/WarehouseApprovalsScreen';
import WarehouseIssuesScreen from '../screens/WarehouseIssuesScreen';
import WarehouseStaffProductsScreen from '../screens/WarehouseStaffProductsScreen';
import WarehouseStaffOrdersScreen from '../screens/WarehouseStaffOrdersScreen';
import CashierPosTerminalScreen from '../screens/CashierPosTerminalScreen';
import SellerDashboardScreen from '../screens/SellerDashboardScreen';
import SellerProductsScreen from '../screens/SellerProductsScreen';
import SellerOrdersScreen from '../screens/SellerOrdersScreen';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';
import DriverMapScreen from '../screens/DriverMapScreen';
import DriverActiveJobScreen from '../screens/DriverActiveJobScreen';
import DriverJobHistoryScreen from '../screens/DriverJobHistoryScreen';
import AdminCommentsScreen from '../screens/AdminCommentsScreen';
import SupportManagerCommentsScreen from '../screens/SupportManagerCommentsScreen';
import AdminFeedbackScreen from '../screens/AdminFeedbackScreen';
import AdminDeliveriesScreen from '../screens/AdminDeliveriesScreen';
import AdminDiscountsScreen from '../screens/AdminDiscountsScreen';
import AdminPromotionsScreen from '../screens/AdminPromotionsScreen';
import AdminInstallmentsScreen from '../screens/AdminInstallmentsScreen';
import AdminPosAnalyticsScreen from '../screens/AdminPosAnalyticsScreen';
import AdminProfileScreen from '../screens/AdminProfileScreen';

export const ADMIN_DRAWER_SCREENS = [
  {
    name: 'AdminDashboard',
    component: AdminDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['admin', 'operations_manager'],
  },
  {
    name: 'SupportManagerDashboard',
    component: SupportManagerDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['support_manager'],
  },
  {
    name: 'SupportAgentDashboard',
    component: SupportAgentDashboardScreen,
    titleKey: 'ui.sidebar.menu.support_agent_dashboard',
    icon: 'bar-chart-2',
    roles: ['support_agent'],
  },
  {
    name: 'WarehouseManagerDashboard',
    component: WarehouseManagerDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['warehouse_manager'],
  },
  {
    name: 'WarehouseStaffDashboard',
    component: WarehouseStaffDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['warehouse_staff'],
  },
  {
    name: 'CashierPosTerminal',
    component: CashierPosTerminalScreen,
    titleKey: 'ui.sidebar.menu.posTerminal',
    icon: 'credit-card',
    roles: ['cashier'],
  },
  {
    name: 'SellerDashboard',
    component: SellerDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['seller'],
  },
  {
    name: 'SellerProducts',
    component: SellerProductsScreen,
    titleKey: 'ui.sidebar.menu.products',
    icon: 'package',
    roles: ['seller'],
  },
  {
    name: 'SellerOrders',
    component: SellerOrdersScreen,
    titleKey: 'ui.sidebar.menu.orders',
    icon: 'clipboard',
    roles: ['seller'],
  },
  {
    name: 'DriverDashboard',
    component: DriverDashboardScreen,
    titleKey: 'ui.sidebar.menu.dashboard',
    icon: 'bar-chart-2',
    roles: ['driver'],
  },
  {
    name: 'DriverMap',
    component: DriverMapScreen,
    titleKey: 'ui.sidebar.menu.findJobs',
    icon: 'map-pin',
    roles: ['driver'],
  },
  {
    name: 'DriverActiveJob',
    component: DriverActiveJobScreen,
    titleKey: 'ui.sidebar.menu.activeJob',
    icon: 'truck',
    roles: ['driver'],
  },
  {
    name: 'DriverJobHistory',
    component: DriverJobHistoryScreen,
    titleKey: 'ui.sidebar.menu.history',
    icon: 'clock',
    roles: ['driver'],
  },
  {
    name: 'AdminUsers',
    component: AdminUsersScreen,
    titleKey: 'ui.sidebar.menu.users',
    icon: 'users',
    roles: ['admin'],
  },
  {
    name: 'AdminProducts',
    component: AdminProductsScreen,
    titleKey: 'ui.sidebar.menu.products',
    icon: 'package',
    roles: ['admin'],
  },
  {
    name: 'AdminPromotions',
    component: AdminPromotionsScreen,
    titleKey: 'ui.sidebar.menu.promotions',
    icon: 'tag',
    roles: ['admin'],
  },
  {
    name: 'AdminDiscounts',
    component: AdminDiscountsScreen,
    titleKey: 'ui.sidebar.menu.discounts',
    icon: 'percent',
    roles: ['admin'],
  },
  {
    name: 'AdminCategories',
    component: AdminCategoriesScreen,
    titleKey: 'ui.sidebar.menu.categories',
    icon: 'grid',
    roles: ['admin'],
  },
  {
    name: 'AdminOrders',
    component: AdminOrdersScreen,
    titleKey: 'ui.sidebar.menu.orders',
    icon: 'clipboard',
    roles: ['admin', 'operations_manager'],
  },
  {
    name: 'AdminInstallments',
    component: AdminInstallmentsScreen,
    titleKey: 'ui.sidebar.menu.installments',
    icon: 'credit-card',
    roles: ['admin', 'operations_manager'],
  },
  {
    name: 'AdminDeliveries',
    component: AdminDeliveriesScreen,
    titleKey: 'ui.sidebar.menu.deliveries',
    icon: 'truck',
    roles: ['admin', 'operations_manager'],
  },
  {
    name: 'WarehouseInventory',
    component: WarehouseInventoryScreen,
    titleKey: 'ui.sidebar.menu.warehouseInventory',
    icon: 'package',
    roles: ['warehouse_manager'],
  },
  {
    name: 'WarehouseApprovals',
    component: WarehouseApprovalsScreen,
    titleKey: 'ui.sidebar.menu.warehouseApprovals',
    icon: 'check-circle',
    roles: ['warehouse_manager'],
  },
  {
    name: 'WarehouseIssues',
    component: WarehouseIssuesScreen,
    titleKey: 'ui.sidebar.menu.warehouseIssues',
    icon: 'alert-triangle',
    roles: ['warehouse_manager'],
  },
  {
    name: 'WarehouseStaffProducts',
    component: WarehouseStaffProductsScreen,
    titleKey: 'ui.sidebar.menu.products',
    icon: 'package',
    roles: ['warehouse_staff'],
  },
  {
    name: 'WarehouseStaffOrders',
    component: WarehouseStaffOrdersScreen,
    titleKey: 'ui.sidebar.menu.orders',
    icon: 'clipboard',
    roles: ['warehouse_staff'],
  },
  {
    name: 'AdminTickets',
    component: AdminTicketsScreen,
    titleKey: 'ui.sidebar.menu.tickets',
    icon: 'message-circle',
    roles: ['admin', 'support_manager'],
  },
  {
    name: 'SupportAgentTickets',
    component: SupportAgentTicketsScreen,
    titleKey: 'ui.sidebar.menu.tickets',
    icon: 'message-circle',
    roles: ['support_agent'],
  },
  {
    name: 'SupportAgentChats',
    component: SupportAgentChatsScreen,
    titleKey: 'ui.pages.support_agent.dashboard.activeChats',
    icon: 'message-square',
    roles: ['support_agent'],
  },
  {
    name: 'SupportManagerComments',
    component: SupportManagerCommentsScreen,
    titleKey: 'ui.sidebar.menu.reviews',
    icon: 'message-square',
    roles: ['support_manager'],
  },
  {
    name: 'AdminComments',
    component: AdminCommentsScreen,
    titleKey: 'ui.sidebar.menu.reviews',
    icon: 'message-square',
    roles: ['admin'],
  },
  {
    name: 'AdminFeedback',
    component: AdminFeedbackScreen,
    titleKey: 'ui.sidebar.menu.feedback',
    icon: 'star',
    roles: ['admin', 'support_manager'],
  },
  {
    name: 'AdminPosAnalytics',
    component: AdminPosAnalyticsScreen,
    titleKey: 'ui.sidebar.menu.posTerminal',
    icon: 'pie-chart',
    roles: ['admin'],
  },
  {
    name: 'AdminProfile',
    component: AdminProfileScreen,
    titleKey: 'ui.mobile.nav.profile',
    icon: 'user',
    roles: ['admin', 'operations_manager', 'support_manager', 'support_agent', 'warehouse_manager', 'warehouse_staff', 'cashier', 'seller', 'driver'],
  },
];

export const getDrawerScreensForRole = (role) => {
  const normalized = String(role || 'admin').toLowerCase();
  return ADMIN_DRAWER_SCREENS.filter((screen) => screen.roles.includes(normalized));
};

export const getDefaultDrawerRouteForRole = (role) => {
  if (role === 'support_manager') {
    return 'SupportManagerDashboard';
  }
  if (role === 'support_agent') {
    return 'SupportAgentDashboard';
  }
  if (role === 'warehouse_manager') {
    return 'WarehouseManagerDashboard';
  }
  if (role === 'warehouse_staff') {
    return 'WarehouseStaffDashboard';
  }
  if (role === 'cashier') {
    return 'CashierPosTerminal';
  }
  if (role === 'seller') {
    return 'SellerDashboard';
  }
  if (role === 'driver') {
    return 'DriverDashboard';
  }
  const screens = getDrawerScreensForRole(role);
  return screens[0]?.name || 'AdminDashboard';
};

export const ROLE_DASHBOARD_PATHS = {
  admin: '/admin',
  operations_manager: '/operations',
  cashier: '/cashier',
  seller: '/seller',
  warehouse_staff: '/warehouse-staff',
  warehouse_manager: '/warehouse',
  support_manager: '/support',
  support_agent: '/support-agent',
  driver: '/driver',
};

export const getRoleDashboardPath = (role) => {
  if (!role || role === 'customer') {
    return null;
  }
  return ROLE_DASHBOARD_PATHS[role] || null;
};

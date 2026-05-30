import { useContext, useMemo } from 'react';

import { AuthContext } from '../../context/AuthContext';

import { useTUi } from '../../i18n/uiText';

export const PANEL_ACCESS_ROLES = [
  'admin',
  'operations_manager',
  'support_manager',
  'support_agent',
  'warehouse_manager',
  'warehouse_staff',
  'cashier',
  'seller',
  'driver',
];

export const usePanelRole = () => {
  const { user } = useContext(AuthContext);
  const tUi = useTUi();
  const role = user?.role;
  const isOperationsManager = role === 'operations_manager';
  const isSupportManager = role === 'support_manager';
  const isSupportAgent = role === 'support_agent';
  const isWarehouseManager = role === 'warehouse_manager';
  const isWarehouseStaff = role === 'warehouse_staff';
  const isCashier = role === 'cashier';
  const isSeller = role === 'seller';
  const isDriver = role === 'driver';

  const panelKicker = useMemo(() => {
    if (isDriver) {
      return tUi('ui.sidebar.panel.driver');
    }
    if (isSeller) {
      return tUi('ui.sidebar.panel.seller');
    }
    if (isCashier) {
      return tUi('ui.sidebar.panel.cashier');
    }
    if (isWarehouseStaff) {
      return tUi('ui.sidebar.panel.warehouseStaff');
    }
    if (isWarehouseManager) {
      return tUi('ui.sidebar.panel.warehouse');
    }
    if (isSupportAgent) {
      return tUi('ui.sidebar.panel.support_agent');
    }
    if (isSupportManager) {
      return tUi('ui.sidebar.panel.support');
    }
    if (isOperationsManager) {
      return tUi('ui.sidebar.panel.operations');
    }
    return tUi('ui.sidebar.panel.admin');
  }, [
    isCashier,
    isDriver,
    isOperationsManager,
    isSeller,
    isSupportAgent,
    isSupportManager,
    isWarehouseManager,
    isWarehouseStaff,
    tUi,
  ]);

  return {
    user,
    role,
    isOperationsManager,
    isSupportManager,
    isSupportAgent,
    isWarehouseManager,
    isWarehouseStaff,
    isCashier,
    isSeller,
    isDriver,
    isAdmin: role === 'admin',
    panelKicker,
  };
};

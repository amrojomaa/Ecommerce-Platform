/** Order statuses aligned with backend `order.py` transitions (no "shipped" step) */

export const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  paid: 'ui.pages.orders.status.paid',
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
};

export const REVENUE_ORDER_STATUSES = [
  'paid',
  'preparing',
  'packed',
  'ready_for_pickup',
  'assigned',
  'picked_up',
  'delivering',
  'delivered',
  'shipped',
];

export const ADMIN_ORDER_STATUS_FILTERS = [
  'all',
  'revenue',
  'pos',
  'created',
  'paid',
  'preparing',
  'packed',
  'ready_for_pickup',
  'assigned',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
];

export const getAvailableOrderStatusTransitions = (currentStatus, options = {}) => {
  const { saleChannel } = options;
  const status = String(currentStatus || 'created').toLowerCase();

  switch (status) {
    case 'created':
      return ['paid', 'cancelled'];
    case 'paid':
      if (saleChannel === 'pos') {
        return ['delivered', 'cancelled'];
      }
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['packed', 'cancelled'];
    case 'packed':
      return ['ready_for_pickup', 'cancelled'];
    case 'ready_for_pickup':
      return ['delivered', 'cancelled'];
    case 'shipped':
      return ['delivered', 'cancelled'];
    case 'assigned':
      return ['picked_up', 'cancelled'];
    case 'picked_up':
      return ['delivering', 'delivered', 'cancelled'];
    case 'delivering':
      return ['delivered', 'cancelled'];
    case 'delivered':
      return ['cancelled'];
    case 'cancelled':
      return [];
    default:
      return ['cancelled'];
  }
};

export const filterOrdersByStatus = (ordersList, statusFilter) => {
  if (statusFilter === 'all') return ordersList;

  if (statusFilter === 'revenue') {
    return ordersList.filter((order) =>
      REVENUE_ORDER_STATUSES.includes((order.status || 'created').toLowerCase())
    );
  }

  if (statusFilter === 'pos') {
    return ordersList.filter((order) => order.sale_channel === 'pos');
  }

  return ordersList.filter(
    (order) => (order.status || 'created').toLowerCase() === statusFilter.toLowerCase()
  );
};

export const DELIVERY_STATUS_LABEL_KEYS = {
  assigned: 'ui.pages.driver.status.assigned',
  picked_up: 'ui.pages.driver.status.pickedUp',
  delivering: 'ui.pages.driver.status.delivering',
  delivered: 'ui.pages.driver.status.delivered',
  cancelled: 'ui.pages.driver.status.cancelled',
};

const normalizeDeliveryStatus = (status) => (status || '').toLowerCase().trim();

export const getDeliveryStatusLabel = (status, t) => {
  const normalized = normalizeDeliveryStatus(status);
  const key = DELIVERY_STATUS_LABEL_KEYS[normalized];
  if (key) return t(key);
  return normalized.replace(/_/g, ' ') || status || '';
};

export const getDeliveryStatusClass = (status) => {
  const normalized = normalizeDeliveryStatus(status);
  if (DELIVERY_STATUS_LABEL_KEYS[normalized]) {
    return `drv-status-badge drv-status-badge--${normalized}`;
  }
  return 'drv-status-badge drv-status-badge--default';
};

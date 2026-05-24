import { tUi } from './uiText';

export const getRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase().trim();
  if (!normalized) {
    return '';
  }

  const key = `roles.${normalized}`;
  const label = tUi(key);
  return label === key ? normalized.replace(/_/g, ' ') : label;
};

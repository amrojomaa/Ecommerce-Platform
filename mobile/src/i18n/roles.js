import { tUi } from './uiText';

export const getRoleLabel = (role, language) => {
  const normalized = String(role || '').toLowerCase().trim();
  if (!normalized) {
    return '';
  }

  const key = `roles.${normalized}`;
  const label = tUi(key, language);
  return label === key ? normalized.replace(/_/g, ' ') : label;
};

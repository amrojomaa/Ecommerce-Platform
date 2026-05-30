import API_BASE_URL from '../config/api';

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

export const getApiBaseUrl = () => normalizeBaseUrl(API_BASE_URL);

export const getImageUrl = (imagePath) => {
  if (!imagePath) return `${getApiBaseUrl()}/images/placeholder.jpg`;
  if (imagePath.startsWith('http')) return imagePath;
  const baseUrl = getApiBaseUrl();
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${baseUrl}${normalizedPath}`;
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email || '').trim());
};

const STRONG_PASSWORD_MIN_LENGTH = 9;

export const getPasswordValidationChecks = (password) => {
  const value = String(password || '');
  return {
    hasMinLength: value.length >= STRONG_PASSWORD_MIN_LENGTH,
    hasUpperAndLower: /[A-Z]/.test(value) && /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
  };
};

export const getPasswordStrengthProgress = (password) => {
  const checks = getPasswordValidationChecks(password);
  const completedRules = Object.values(checks).filter(Boolean).length;
  return completedRules * 25;
};

export const isStrongPassword = (password) => {
  const checks = getPasswordValidationChecks(password);
  return Object.values(checks).every(Boolean);
};

export const getStrongPasswordErrorMessage = () =>
  'Password does not satisfy the required security requirements.';

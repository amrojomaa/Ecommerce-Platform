import { useCallback } from 'react';

export const useCurrency = () => {
  const formatCurrency = useCallback((value) => {
    const num = Number(value);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  }, []);

  return { formatCurrency };
};

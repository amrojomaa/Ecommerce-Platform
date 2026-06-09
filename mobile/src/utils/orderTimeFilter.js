export const TIME_PERIODS = ['all', 'day', 'month', 'year'];

const pad2 = (n) => String(n).padStart(2, '0');

const formatDayInputValue = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatMonthInputValue = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const getDefaultTimeValue = (period) => {
  const now = new Date();
  if (period === 'day') return formatDayInputValue(now);
  if (period === 'month') return formatMonthInputValue(now);
  if (period === 'year') return String(now.getFullYear());
  return '';
};

const parseOrderCreatedAt = (order) => {
  if (!order?.created_at) return null;
  const parsed = new Date(order.created_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const orderMatchesTimePeriod = (order, period, timeValue) => {
  if (period === 'all') return true;

  const createdAt = parseOrderCreatedAt(order);
  if (!createdAt) return false;

  if (period === 'day') {
    if (!timeValue) return true;
    const [y, m, d] = timeValue.split('-').map(Number);
    return (
      createdAt.getFullYear() === y
      && createdAt.getMonth() + 1 === m
      && createdAt.getDate() === d
    );
  }

  if (period === 'month') {
    if (!timeValue) return true;
    const [y, m] = timeValue.split('-').map(Number);
    return createdAt.getFullYear() === y && createdAt.getMonth() + 1 === m;
  }

  if (period === 'year') {
    if (!timeValue) return true;
    return createdAt.getFullYear() === Number(timeValue);
  }

  return true;
};


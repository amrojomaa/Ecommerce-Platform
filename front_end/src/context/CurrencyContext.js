import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_STORAGE_KEY,
  DEFAULT_EXCHANGE_RATES,
  SUPPORTED_CURRENCIES,
  convertFromUSD,
  fetchLatestExchangeRates,
  formatPrice,
  getCurrentCurrency,
  getExchangeRatesUpdatedAt,
  getStoredExchangeRates,
  getStripeCurrencyCode,
  setCurrentCurrency as persistCurrentCurrency,
  setStoredExchangeRates,
} from '../utils/helpers';

export const CurrencyContext = createContext();

const EXCHANGE_RATE_REFRESH_MS = 6 * 60 * 60 * 1000;

export const CurrencyProvider = ({ children }) => {
  const [currentCurrency, setCurrentCurrencyState] = useState(() => getCurrentCurrency());
  const [exchangeRates, setExchangeRates] = useState(() => getStoredExchangeRates());
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(() => getExchangeRatesUpdatedAt());
  const [ratesLoading, setRatesLoading] = useState(false);

  const refreshExchangeRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const latest = await fetchLatestExchangeRates();
      const savedRates = setStoredExchangeRates(latest.rates);
      setExchangeRates(savedRates);
      setRatesUpdatedAt(latest.updatedAt);
    } catch (error) {
      setExchangeRates((previousRates) => ({
        ...DEFAULT_EXCHANGE_RATES,
        ...previousRates,
      }));
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshExchangeRates();
    const intervalId = setInterval(refreshExchangeRates, EXCHANGE_RATE_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [refreshExchangeRates]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key?.startsWith(CURRENCY_STORAGE_KEY)) {
        setCurrentCurrencyState(getCurrentCurrency());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentCurrencyState(getCurrentCurrency());
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const setCurrency = useCallback((currencyCode) => {
    const normalized = persistCurrentCurrency(currencyCode);
    setCurrentCurrencyState(normalized);
  }, []);

  const convertPrice = useCallback(
    (amountInUsd, targetCurrency = currentCurrency) =>
      convertFromUSD(amountInUsd, targetCurrency, exchangeRates),
    [currentCurrency, exchangeRates]
  );

  const formatCurrency = useCallback(
    (amountInUsd, targetCurrency = currentCurrency) =>
      formatPrice(amountInUsd, targetCurrency, exchangeRates),
    [currentCurrency, exchangeRates]
  );

  const value = useMemo(
    () => ({
      currentCurrency,
      setCurrency,
      exchangeRates,
      ratesLoading,
      ratesUpdatedAt,
      refreshExchangeRates,
      convertPrice,
      formatCurrency,
      stripeCurrency: getStripeCurrencyCode(currentCurrency),
      supportedCurrencies: SUPPORTED_CURRENCIES,
    }),
    [
      currentCurrency,
      setCurrency,
      exchangeRates,
      ratesLoading,
      ratesUpdatedAt,
      refreshExchangeRates,
      convertPrice,
      formatCurrency,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

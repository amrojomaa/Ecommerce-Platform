import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CashierPosContext = createContext(null);

export const CashierPosProvider = ({ children }) => {
  const [search, setSearch] = useState('');
  const [historyRequestId, setHistoryRequestId] = useState(0);

  const openSalesHistory = useCallback(() => {
    setHistoryRequestId((id) => id + 1);
  }, []);

  const value = useMemo(
    () => ({
      search,
      setSearch,
      historyRequestId,
      openSalesHistory,
    }),
    [search, historyRequestId, openSalesHistory]
  );

  return <CashierPosContext.Provider value={value}>{children}</CashierPosContext.Provider>;
};

export const useCashierPos = () => useContext(CashierPosContext);

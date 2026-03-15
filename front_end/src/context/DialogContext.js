import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/components/Dialog.css';

export const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    resolve: null,
  });

  const closeDialog = useCallback((result) => {
    setDialogState((prev) => {
      if (prev.resolve) {
        prev.resolve(result);
      }
      return {
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: 'Cancel',
        resolve: null,
      };
    });
  }, []);

  const showConfirm = useCallback(({ title = '', message, confirmText = 'OK', cancelText = 'Cancel' }) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message: message || '',
        confirmText,
        cancelText,
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    if (!dialogState.isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeDialog(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [dialogState.isOpen, closeDialog]);

  const value = useMemo(
    () => ({
      showConfirm,
    }),
    [showConfirm]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialogState.isOpen && (
        <div className="app-dialog-overlay" onClick={() => closeDialog(false)}>
          <div className="app-dialog-modal" onClick={(e) => e.stopPropagation()}>
            {dialogState.title && <h3>{dialogState.title}</h3>}
            <p>{dialogState.message}</p>
            <div className="app-dialog-actions">
              <button
                type="button"
                className="app-dialog-confirm-btn"
                onClick={() => closeDialog(true)}
              >
                {dialogState.confirmText}
              </button>
              <button
                type="button"
                className="app-dialog-cancel-btn"
                onClick={() => closeDialog(false)}
              >
                {dialogState.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

import { tUi } from "../i18n/uiText";import React, { createContext, useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export const ConfirmContext = createContext(null);

const initialDialogState = {
  isOpen: false,
  title: tUi("ui.context.confirmContext.pleaseConfirm_9a38bd4323"),
  message: '',
  confirmText: tUi("ui.context.confirmContext.confirm_92f10c418f"),
  cancelText: tUi("ui.context.confirmContext.cancel_c50fab1ce7")
};

export const ConfirmProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState(initialDialogState);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialogState(initialDialogState);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        title: options.title || initialDialogState.title,
        message: options.message || '',
        confirmText: options.confirmText || initialDialogState.confirmText,
        cancelText: options.cancelText || initialDialogState.cancelText
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={() => closeDialog(true)}
        onCancel={() => closeDialog(false)} />
      
    </ConfirmContext.Provider>);

};

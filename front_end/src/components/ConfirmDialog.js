import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/components/ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title">{title || t('ui.confirm.defaultTitle')}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-cancel-btn"
            onClick={onCancel}
          >
            {cancelText || t('ui.confirm.cancel')}
          </button>
          <button
            type="button"
            className="confirm-dialog-confirm-btn"
            onClick={onConfirm}
          >
            {confirmText || t('ui.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

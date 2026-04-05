import { useContext } from 'react';
import { ConfirmContext } from '../context/ConfirmContext';

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return confirm;
};

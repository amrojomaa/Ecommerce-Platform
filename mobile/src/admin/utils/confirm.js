import { Alert } from 'react-native';

export const confirmAction = (
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
) => {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
};

import { toast } from 'react-toastify';
import i18n from 'i18next';
import { normalizeLanguageCode } from './constants';

let isToastPatched = false;

const hasLatinText = (value) => /[A-Za-z]/.test(value || '');

const getGenericToastMessage = (method) => {
  if (method === 'success') {
    return i18n.t('ui.toast.operationSuccess', {
      defaultValue: 'Operation completed successfully.',
    });
  }

  return i18n.t('ui.toast.operationFailed', {
    defaultValue: 'Operation failed. Please try again.',
  });
};

const translateToastContent = (content, method) => {
  if (typeof content === 'string') {
    const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    if (languageCode !== 'en' && hasLatinText(content)) {
      return getGenericToastMessage(method);
    }
    return content;
  }
  return content;
};

export const patchToastTranslations = () => {
  if (isToastPatched) {
    return;
  }

  ['success', 'error', 'info', 'warn', 'loading'].forEach((method) => {
    const originalMethod = toast[method]?.bind(toast);
    if (!originalMethod) {
      return;
    }

    try {
      toast[method] = (content, options) => {
        return originalMethod(translateToastContent(content, method), options);
      };
    } catch (error) {
      // Ignore if a toast method is not writable.
    }
  });

  isToastPatched = true;
};

import http from './http';

const AI_TRANSLATION_ENDPOINT = process.env.REACT_APP_AI_TRANSLATION_ENDPOINT || '';

export const isAiTranslationEnabled = () => Boolean(AI_TRANSLATION_ENDPOINT);

export const suggestTranslation = async ({ sourceText, sourceLanguage = 'en', targetLanguage = 'fr' }) => {
  if (!isAiTranslationEnabled()) {
    throw new Error('AI translation service is not configured.');
  }

  const response = await http.post(AI_TRANSLATION_ENDPOINT, {
    source_text: sourceText,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });

  return response?.data?.translation || '';
};


import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

export function useRtlLayout() {
  const { isRtl } = useLanguage();

  return useMemo(
    () => ({
      isRtl,
      textAlign: isRtl ? 'right' : 'left',
      writingDirection: isRtl ? 'rtl' : 'ltr',
      row: isRtl ? 'row-reverse' : 'row',
      alignSelfStart: isRtl ? 'flex-end' : 'flex-start',
      alignSelfEnd: isRtl ? 'flex-start' : 'flex-end',
    }),
    [isRtl]
  );
}

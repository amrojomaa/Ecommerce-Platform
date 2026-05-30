import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

export function useThemedStyles(createStyles) {
  const { colors, shadow, isDark } = useTheme();

  return useMemo(
    () => createStyles({ colors, shadow, isDark }),
    [colors, shadow, isDark, createStyles]
  );
}

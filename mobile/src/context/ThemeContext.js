import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_STORAGE_KEY = 'theme_mode';

const lightColors = {
  background: '#F5F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  primary: '#2563EB',
  accent: '#F59E0B',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  success: '#16A34A',
  warning: '#F97316',
  danger: '#DC2626',
};

const darkColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  primary: '#3B82F6',
  accent: '#FBBF24',
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: '#334155',
  success: '#22C55E',
  warning: '#FB923C',
  danger: '#F87171',
};

const lightShadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 3,
};

const darkShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 3,
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('system');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setMode(stored);
        }
      })
      .catch(() => {});
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo(() => {
    const setThemeMode = async (nextMode) => {
      if (nextMode !== 'light' && nextMode !== 'dark' && nextMode !== 'system') {
        return;
      }
      setMode(nextMode);
      try {
        await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextMode);
      } catch (_) {}
    };

    return {
      colors: isDark ? darkColors : lightColors,
      shadow: isDark ? darkShadow : lightShadow,
      isDark,
      mode,
      setThemeMode,
      toggleTheme: () => setThemeMode(isDark ? 'light' : 'dark'),
    };
  }, [isDark, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

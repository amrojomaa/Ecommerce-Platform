import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminThemeToggleButton from '../../admin/components/AdminThemeToggleButton';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../../i18n/constants';

const CustomerHeaderActions = () => {
  const { colors } = useTheme();
  const { language, setLanguage, isRtl } = useLanguage();

  const cycleLanguage = () => {
    const idx = SUPPORTED_LANGUAGES.indexOf(language);
    const next = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
    setLanguage(next);
  };

  return (
    <View
      style={[
        styles.row,
        { flexDirection: isRtl ? 'row-reverse' : 'row' },
      ]}
    >
      <Pressable style={[styles.iconBtn, { borderColor: colors.border }]} onPress={cycleLanguage}>
        <Feather name="globe" size={18} color={colors.text} />
      </Pressable>
      <AdminThemeToggleButton />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CustomerHeaderActions;

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTUi } from '../../i18n/uiText';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { SUPPORTED_LANGUAGES } from '../../i18n/constants';

const AdminDrawerControls = () => {
  const { colors } = useTheme();
  const { language, setLanguage } = useLanguage();
  const tUi = useTUi();
  const { textAlign, row } = useRtlLayout();

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionLabel, { color: colors.muted, textAlign }]}>
        {tUi('language.label')}
      </Text>
      <View style={[styles.languageRow, { flexDirection: row }]}>
        {SUPPORTED_LANGUAGES.map((code) => {
          const active = language === code;
          return (
            <Pressable
              key={code}
              style={[
                styles.languagePill,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setLanguage(code)}
            >
              <Text style={[styles.languagePillText, { color: active ? colors.surface : colors.text }]}>
                {tUi(`language.option.${code}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  languageRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  languagePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  languagePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AdminDrawerControls;

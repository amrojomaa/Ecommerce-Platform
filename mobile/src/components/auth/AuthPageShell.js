import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AuthHero from './AuthHero';
import { createAuthStyles } from './authStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { SUPPORTED_LANGUAGES } from '../../i18n/constants';
import AdminThemeToggleButton from '../../admin/components/AdminThemeToggleButton';

const AuthPageShell = ({ hero, panel, children, footer }) => {
  const navigation = useNavigation();
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const { language, setLanguage, isRtl } = useLanguage();
  const { textAlign, isRtl: rtl } = useRtlLayout();
  const canGoBack = navigation.canGoBack();

  const cycleLanguage = () => {
    const idx = SUPPORTED_LANGUAGES.indexOf(language);
    const next = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
    setLanguage(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topActions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {canGoBack ? (
            <Pressable
              style={styles.iconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={8}
            >
              <Feather
                name={rtl ? 'chevron-right' : 'chevron-left'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          ) : (
            <View />
          )}
          <View style={[styles.topActions, { flexDirection: isRtl ? 'row-reverse' : 'row', marginBottom: 0 }]}>
            <Pressable style={styles.iconBtn} onPress={cycleLanguage}>
              <Feather name="globe" size={18} color={colors.text} />
            </Pressable>
            <AdminThemeToggleButton />
          </View>
        </View>

        {hero ? <AuthHero {...hero} styles={styles} /> : null}

        <View style={styles.panel}>
          <View>
            {panel?.kicker ? (
              <Text style={[styles.panelKicker, { textAlign }]}>{panel.kicker}</Text>
            ) : null}
            {panel?.title ? (
              <Text style={[styles.panelTitle, { textAlign }]}>{panel.title}</Text>
            ) : null}
            {panel?.subtitle ? (
              <Text style={[styles.panelSubtitle, { textAlign }]}>{panel.subtitle}</Text>
            ) : null}
          </View>

          <View style={styles.form}>{children}</View>

          {footer ? (
            <Text style={[styles.footerSwitch, { textAlign }]}>
              {footer.text}{' '}
              {footer.linkLabel ? (
                <Text style={styles.footerLink} onPress={footer.onPressLink}>
                  {footer.linkLabel}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthPageShell;

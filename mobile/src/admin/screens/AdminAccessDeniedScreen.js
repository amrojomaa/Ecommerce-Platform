import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';

const AdminAccessDeniedScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl } = useLanguage();
  const { logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { textAlign: isRtl ? 'right' : 'left' }]}>
        {tUi('ui.mobile.accessDenied.title')}
      </Text>
      <Text style={[styles.subtitle, { textAlign: isRtl ? 'right' : 'left' }]}>
        {tUi('ui.mobile.accessDenied.subtitle')}
      </Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>{tUi('ui.mobile.accessDenied.signOut')}</Text>
      </Pressable>
    </View>
  );
};

const createStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 10,
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    button: {
      marginTop: 18,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
    },
    buttonText: {
      color: colors.surface,
      fontWeight: '700',
    },
  });

export default AdminAccessDeniedScreen;

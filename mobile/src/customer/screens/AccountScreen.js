import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import CustomerScreen from '../components/CustomerScreen';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { confirmAction } from '../../admin/utils/confirm';
import { navigateIfAuthenticated } from '../navigation/customerAuth';

const AUTH_MENU_ITEMS = [
  { key: 'orders', icon: 'package', route: 'Orders', labelKey: 'ui.mobile.customer.account.orders' },
  { key: 'wishlist', icon: 'heart', route: 'Wishlist', labelKey: 'ui.mobile.customer.account.wishlist' },
  { key: 'tickets', icon: 'message-circle', route: 'Tickets', labelKey: 'ui.mobile.customer.account.tickets' },
  { key: 'installments', icon: 'credit-card', route: 'Installments', labelKey: 'ui.mobile.customer.account.installments' },
  { key: 'recommendations', icon: 'star', route: 'Recommendations', labelKey: 'ui.mobile.customer.account.recommendations' },
  { key: 'profile', icon: 'user', route: 'Profile', labelKey: 'ui.mobile.customer.account.profile' },
];

const AccountScreen = () => {
  const navigation = useNavigation();
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { row, textAlign, isRtl } = useRtlLayout();

  const handleLogout = async () => {
    const confirmed = await confirmAction(
      tUi('ui.navbar.logout') || 'Logout',
      tUi('ui.mobile.common.logoutConfirm') || 'Sign out of your account?',
      tUi('ui.navbar.logout') || 'Logout',
      tUi('ui.mobile.common.cancel')
    );
    if (confirmed) await logout();
  };

  const openProtected = (route) => {
    navigateIfAuthenticated(navigation, isAuthenticated, route);
  };

  return (
    <CustomerScreen
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('ui.mobile.customer.account.title')}
      subtitle={
        isAuthenticated
          ? tUi('ui.mobile.customer.account.subtitle')
          : tUi('ui.mobile.customer.account.guestSubtitle')
      }
    >
      {isAuthenticated && user?.email ? (
        <Text style={[styles.email, { color: colors.muted, textAlign }]}>{user.email}</Text>
      ) : null}

      {!isAuthenticated ? (
        <View style={styles.guestActions}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.primaryBtnText}>{tUi('ui.pages.login.login_4b4596ebf5')}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('Signup')}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              {tUi('ui.pages.login.signUp_8e16000dc0')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.menu}>
          {AUTH_MENU_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.menuRow, { borderColor: colors.border, backgroundColor: colors.surface, flexDirection: row }]}
              onPress={() => openProtected(item.route)}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}14` }]}>
                <Feather name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.text, textAlign }]}>{tUi(item.labelKey)}</Text>
              <Feather
                name={isRtl ? 'chevron-left' : 'chevron-right'}
                size={20}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.menuRow, { borderColor: colors.border, backgroundColor: colors.surface, flexDirection: row }]}
        onPress={() => navigation.navigate('About')}
      >
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}14` }]}>
          <Feather name="info" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.menuLabel, { color: colors.text, textAlign }]}>
          {tUi('ui.mobile.customer.account.about')}
        </Text>
        <Feather name={isRtl ? 'chevron-left' : 'chevron-right'} size={20} color={colors.muted} />
      </Pressable>

      {isAuthenticated ? (
        <Pressable
          style={[styles.logoutBtn, { borderColor: colors.danger, backgroundColor: `${colors.danger}12` }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>{tUi('ui.navbar.logout')}</Text>
        </Pressable>
      ) : null}
    </CustomerScreen>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    email: { fontSize: 14, marginBottom: 16 },
    guestActions: { gap: 10, marginBottom: 16 },
    primaryBtn: {
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      ...shadow,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    secondaryBtn: {
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
    },
    secondaryBtnText: { fontWeight: '700', fontSize: 16 },
    menu: { gap: 10, marginBottom: 16 },
    menuRow: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
      ...shadow,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 14,
      marginBottom: 24,
    },
    logoutText: { fontWeight: '700', fontSize: 15 },
  });

export default AccountScreen;

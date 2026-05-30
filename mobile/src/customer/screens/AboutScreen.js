import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import CustomerScreen from '../components/CustomerScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';

const VALUE_PROPS = [
  {
    icon: 'truck',
    titleKey: 'ui.pages.home.valuePropDeliveryTitle_1d1ac5c1d0',
    bodyKey: 'ui.pages.home.valuePropDeliveryBody_2c33b0dd6f',
  },
  {
    icon: 'shield',
    titleKey: 'ui.pages.home.valuePropPaymentsTitle_7f8b4c3d2a',
    bodyKey: 'ui.pages.home.valuePropPaymentsBody_3e51c43f90',
  },
  {
    icon: 'headphones',
    titleKey: 'ui.pages.home.valuePropSupportTitle_7a8f1b90ad',
    bodyKey: 'ui.pages.home.valuePropSupportBody_1b8b2d09d8',
  },
];

const AboutScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row } = useRtlLayout();

  return (
    <CustomerScreen
      showBack
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('navbar.aboutUs')}
      subtitle={tUi('ui.pages.home.valuePropsSubtitle_0aa1c14a1b')}
    >
      <Text style={[styles.intro, { color: colors.muted, textAlign }]}>
        {tUi('ui.pages.home.discoverAmazingProductsAtUnbeatable_e717e87b85')}
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
        {tUi('ui.pages.home.valuePropsTitle_f8f0c4ad1a')}
      </Text>

      {VALUE_PROPS.map((item) => (
        <View
          key={item.icon}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <View style={[styles.cardHeader, { flexDirection: row }]}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}14` }]}>
              <Feather name={item.icon} size={20} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text, textAlign }]}>{tUi(item.titleKey)}</Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.muted, textAlign }]}>{tUi(item.bodyKey)}</Text>
        </View>
      ))}

      <Text style={[styles.footer, { color: colors.muted, textAlign }]}>
        {tUi('ui.pages.home.heroNote_1c0a3b7d12')}
      </Text>
    </CustomerScreen>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    intro: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    card: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      ...shadow,
    },
    cardHeader: { alignItems: 'center', gap: 12, marginBottom: 8 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
    cardBody: { fontSize: 14, lineHeight: 20 },
    footer: { fontSize: 13, marginTop: 8, marginBottom: 24 },
  });

export default AboutScreen;

import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import { navigateToCustomerTab } from '../navigation/customerNavigation';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCart } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';

const SHIPPING_OPTIONS = [
  {
    id: 'west_bank_gaza',
    name: 'West Bank and Gaza Strip',
    labelKey: 'ui.pages.checkout.shippingOptionWestBank_b4e8c2d2cb',
    fee: 20,
  },
  {
    id: 'international',
    name: 'International Shipping',
    labelKey: 'ui.pages.checkout.shippingOptionInternational_b4e8c2d2cc',
    fee: 40,
  },
];

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign, row } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const { cartItems, grandTotal, fetchCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [shippingRegion, setShippingRegion] = useState(SHIPPING_OPTIONS[0]);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    zipCode: '',
    country: '',
    phone: '',
  });

  const accountPhone = (user?.phone || '').trim();
  const showPhoneField = !accountPhone;
  const orderTotal = grandTotal + shippingRegion.fee;
  const inputStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  useEffect(() => {
    if (cartItems.length === 0) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.checkout.yourCartIsEmpty_d5391da0dc') });
      navigation.replace('CustomerTabs', { screen: 'Cart' });
    }
  }, [cartItems.length, navigation, tUi]);

  const setField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.address || !formData.city || !formData.zipCode) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.checkout.pleaseFillInAllRequired_50039ce3dd') });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        address: formData.address,
        city: formData.city,
        zipCode: formData.zipCode,
        country: formData.country || undefined,
        phone: accountPhone || formData.phone.trim() || undefined,
        shipping_region: shippingRegion.name,
        shipping_fee: shippingRegion.fee,
      };
      const response = await http.post(ORDER_ENDPOINTS.CHECKOUT, payload);
      await fetchCart();
      if (response.data?.merged) {
        Toast.show({
          type: 'success',
          text1: tUi('ui.pages.checkout.orderMergedSuccessfully_b4e8c2d3ea', { value0: response.data.id }),
        });
      } else {
        Toast.show({ type: 'success', text1: tUi('ui.pages.checkout.orderPlacedSuccessfully_4042f7157d') });
      }
      navigation.replace('Orders');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          error.message ||
          tUi('ui.pages.checkout.failedToPlaceOrder_b4e8c2d2c1'),
      });
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <CustomerScreen showBack title={tUi('ui.pages.checkout.checkout_69315371da')}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </CustomerScreen>
    );
  }

  return (
    <CustomerScreen
      showBack
      title={tUi('ui.pages.checkout.checkout_69315371da')}
      subtitle={tUi('ui.pages.checkout.subtitle_b4e8c2d2c0')}
    >
      <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
        {tUi('ui.pages.checkout.shippingInformation_d88cac7166')}
      </Text>

      {SHIPPING_OPTIONS.map((option) => (
        <Pressable
          key={option.id}
          style={[
            styles.shipOption,
            {
              borderColor: shippingRegion.id === option.id ? colors.primary : colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          onPress={() => setShippingRegion(option)}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>{tUi(option.labelKey)}</Text>
          <Text style={{ color: colors.muted }}>+{formatCurrency(option.fee)}</Text>
        </Pressable>
      ))}

      <Field label={tUi('ui.pages.checkout.address_c66e170a3e')} value={formData.address} onChange={(v) => setField('address', v)} colors={colors} inputStyle={inputStyle} />
      <Field label={tUi('ui.pages.checkout.city_3421768f9e')} value={formData.city} onChange={(v) => setField('city', v)} colors={colors} inputStyle={inputStyle} />
      <Field label={tUi('ui.pages.checkout.zipCode_3c43826e0f')} value={formData.zipCode} onChange={(v) => setField('zipCode', v)} colors={colors} inputStyle={inputStyle} />
      <Field label={tUi('ui.pages.checkout.country_e719f63442')} value={formData.country} onChange={(v) => setField('country', v)} colors={colors} inputStyle={inputStyle} optional />
      {showPhoneField ? (
        <Field label={tUi('ui.pages.checkout.phone_24a3e62f5a')} value={formData.phone} onChange={(v) => setField('phone', v)} colors={colors} inputStyle={inputStyle} optional />
      ) : null}

      <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{tUi('ui.pages.checkout.orderSummary_d0a0edc227')}</Text>
        <Row label={tUi('ui.pages.checkout.subtotal_86a223f217')} value={formatCurrency(grandTotal)} colors={colors} />
        <Row label={tUi('ui.pages.checkout.shipping_c4ae97807a')} value={formatCurrency(shippingRegion.fee)} colors={colors} />
        <Row label={tUi('ui.pages.checkout.total_bdf441497c')} value={formatCurrency(orderTotal)} colors={colors} bold />
      </View>

      <Pressable
        style={[styles.submitBtn, { backgroundColor: colors.primary }, loading && styles.disabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{tUi('ui.pages.checkout.placeOrder_e42fa41868')}</Text>
        )}
      </Pressable>
    </CustomerScreen>
  );
};

const Field = ({ label, value, onChange, colors, inputStyle, optional }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{label}</Text>
    <TextInput
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        color: colors.text,
        backgroundColor: colors.surface,
        ...inputStyle,
      }}
      value={value}
      onChangeText={onChange}
      placeholderTextColor={colors.muted}
    />
  </View>
);

const Row = ({ label, value, colors, bold }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
    <Text style={{ color: colors.muted }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: bold ? '700' : '600' }}>{value}</Text>
  </View>
);

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, marginTop: 4 },
    shipOption: {
      borderWidth: 2,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginVertical: 16 },
    submitBtn: {
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 24,
      ...shadow,
    },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    disabled: { opacity: 0.7 },
  });

export default CheckoutScreen;

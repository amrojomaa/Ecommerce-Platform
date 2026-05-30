import React, { useContext } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCart } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import { useLanguage } from '../../context/LanguageContext';
import { localizeProduct } from '../../utils/localizedContent';
import { buildImageUrl } from '../../admin/utils/format';
import { AuthContext } from '../../context/AuthContext';
import { navigateIfAuthenticated } from '../navigation/customerAuth';

const PLACEHOLDER_IMAGE = '/images/placeholder.jpg';

const CartScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { row, textAlign } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const {
    cartItems,
    subtotal,
    promotionDiscount,
    appliedPromotion,
    grandTotal,
    loading,
    updateCartItem,
    removeCartItem,
  } = useCart();

  const handleQty = async (item, delta) => {
    const next = Math.max(1, (item.quantity || 1) + delta);
    const result = await updateCartItem(item.id, next);
    if (!result.success) {
      Toast.show({ type: 'error', text1: result.error || tUi('ui.pages.cart.failedToUpdate_a3f8c2d1e8') });
    }
  };

  const handleRemove = async (itemId) => {
    const result = await removeCartItem(itemId);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.cart.itemRemovedFromCart_b8877d495a') });
    } else {
      Toast.show({ type: 'error', text1: result.error });
    }
  };

  const subtitle =
    cartItems.length === 0
      ? tUi('ui.pages.cart.subtitleEmpty_a3f8c2d1e7')
      : cartItems.length === 1
        ? tUi('ui.pages.cart.subtitleWithItems_a3f8c2d1e6', { count: 1 })
        : tUi('ui.pages.cart.subtitleWithItems_a3f8c2d1e6_plural', { count: cartItems.length });

  return (
    <CustomerScreen
      kicker={tUi('ui.pages.cart.kicker_a3f8c2d1e5')}
      title={tUi('ui.pages.cart.shoppingCart_7367ced874')}
      subtitle={subtitle}
    >
      {loading && cartItems.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : cartItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text, textAlign }]}>{tUi('ui.pages.cart.emptyTitle_a3f8c2d1ea')}</Text>
          <Text style={[styles.emptyHint, { color: colors.muted, textAlign }]}>{tUi('ui.pages.cart.emptyHint_a3f8c2d1eb')}</Text>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('Products')}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.cart.continueShopping_5009154016')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {cartItems.map((item) => {
            const product = item.product || {};
            const localized = localizeProduct(product, language);
            const originalPrice = Number(product.original_price ?? product.price ?? 0);
            const unitPrice = Number(product.discounted_price ?? product.price ?? 0);
            const hasDiscount =
              Boolean(product.has_discount) || (unitPrice > 0 && unitPrice < originalPrice);
            const imagePath = product.images?.length ? product.images[0] : PLACEHOLDER_IMAGE;
            const lineTotal = Number(item.total ?? unitPrice * (item.quantity || 1));

            return (
            <View
              key={item.id}
              style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Image source={{ uri: buildImageUrl(imagePath) }} style={styles.itemImage} />
              <View style={styles.itemBody}>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                  {localized?.localized_name || product.name || tUi('ui.pages.cart.product_d44e1d3515')}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {tUi('ui.pages.cart.quantityTimesPrice_e2b5c8f4d6', {
                    value0: item.quantity,
                    value1: formatCurrency(unitPrice),
                  })}
                </Text>
                {hasDiscount ? (
                  <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: 'line-through' }}>
                    {formatCurrency(originalPrice)}
                  </Text>
                ) : null}
                <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(lineTotal)}
                </Text>
                <View style={[styles.itemActions, { flexDirection: row }]}>
                  <Pressable style={styles.qtyBtn} onPress={() => handleQty(item, -1)}>
                    <Feather name="minus" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.quantity}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => handleQty(item, 1)}>
                    <Feather name="plus" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => handleRemove(item.id)}>
                    <Feather name="trash-2" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
            );
          })}

          <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{tUi('ui.pages.cart.orderSummary_97f6cd5623')}</Text>
            <SummaryRow label={tUi('ui.pages.cart.subtotal_a87a323a5f')} value={formatCurrency(subtotal)} colors={colors} />
            {promotionDiscount > 0 ? (
              <SummaryRow
                label={tUi('ui.pages.cart.promotion_956ee3b550')}
                value={`-${formatCurrency(promotionDiscount)}`}
                colors={colors}
                accent
              />
            ) : null}
            {appliedPromotion?.name ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>{appliedPromotion.name}</Text>
            ) : null}
            <SummaryRow label={tUi('ui.pages.cart.shipping_1bc05a98aa')} value={tUi('ui.pages.cart.shippingCalculatedAtCheckout_f3a9c1e7b2')} colors={colors} />
            <SummaryRow label={tUi('ui.pages.cart.total_cf0b507074')} value={formatCurrency(grandTotal)} colors={colors} bold />
          </View>

          <Pressable
            style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigateIfAuthenticated(navigation, isAuthenticated, 'Checkout')}
          >
            <Text style={styles.checkoutBtnText}>{tUi('ui.pages.cart.proceedToCheckout_48e6337c2b')}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </>
      )}
    </CustomerScreen>
  );
};

const SummaryRow = ({ label, value, colors, accent, bold }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
    <Text style={{ color: colors.muted, fontWeight: bold ? '700' : '500' }}>{label}</Text>
    <Text style={{ color: accent ? colors.success : colors.text, fontWeight: bold ? '700' : '600' }}>{value}</Text>
  </View>
);

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700' },
    emptyHint: { fontSize: 14, textAlign: 'center', maxWidth: 280 },
    secondaryBtn: {
      marginTop: 8,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    itemCard: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      gap: 12,
      ...shadow,
    },
    itemImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceAlt },
    itemBody: { flex: 1, gap: 4 },
    itemName: { fontSize: 15, fontWeight: '700' },
    itemActions: { alignItems: 'center', gap: 10, marginTop: 8 },
    qtyBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 16 },
    summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    checkoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 999,
      paddingVertical: 14,
      marginBottom: 24,
      ...shadow,
    },
    checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });

export default CartScreen;

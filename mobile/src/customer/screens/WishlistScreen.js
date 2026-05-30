import React from 'react';
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
import { navigateToCustomerTab } from '../navigation/customerNavigation';
import CustomerScreen from '../components/CustomerScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useWishlist } from '../../hooks/useWishlist';
import { useCart } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import { buildImageUrl } from '../../admin/utils/format';
import { confirmAction } from '../../admin/utils/confirm';

const WishlistScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const { wishlistItems, loading, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const subtitle =
    wishlistItems.length === 0
      ? tUi('ui.pages.wishlist.subtitleEmpty_b4e8c2d2d1')
      : wishlistItems.length === 1
        ? tUi('ui.pages.wishlist.subtitleWithItems_b4e8c2d2d0', { count: 1 })
        : tUi('ui.pages.wishlist.subtitleWithItems_b4e8c2d2d0_plural', { count: wishlistItems.length });

  const handleRemove = async (item) => {
    const confirmed = await confirmAction(
      tUi('ui.pages.wishlist.removeFromWishlist_a74e7f0fd2'),
      tUi('ui.pages.wishlist.removeConfirmMessage_b4e8c2d2d2', { value0: item.name }),
      tUi('ui.pages.wishlist.remove_b2597b3f3e'),
      tUi('ui.pages.wishlist.cancel_32e949f897')
    );
    if (!confirmed) return;
    const result = await removeFromWishlist(item.name);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.wishlist.removeFromWishlist_a74e7f0fd2') });
    } else {
      Toast.show({ type: 'error', text1: result.error });
    }
  };

  const handleAddCart = async (item) => {
    const result = await addToCart(item.name, 1);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.products.productAddedToCart_577eece582') });
    } else {
      Toast.show({ type: 'error', text1: result.error || tUi('ui.pages.wishlist.failedToAddToCart_b4e8c2d2d5') });
    }
  };

  return (
    <CustomerScreen showBack title={tUi('ui.pages.wishlist.myWishlist_8547aa7391')} subtitle={subtitle}>
      {loading && wishlistItems.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : wishlistItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text, textAlign }]}>{tUi('ui.pages.wishlist.yourWishlistIsEmpty_25ded470c1')}</Text>
          <Text style={[styles.emptyHint, { color: colors.muted, textAlign }]}>{tUi('ui.pages.wishlist.startAddingProductsYouLove_1dae7ca234')}</Text>
          <Pressable onPress={() => navigateToCustomerTab(navigation, 'Products')}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.wishlist.browseProducts_69993227ec')}</Text>
          </Pressable>
        </View>
      ) : (
        wishlistItems.map((item) => {
          const price = item.discount_enabled ? item.discounted_price : item.price;
          return (
            <View
              key={item.id}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Pressable
                style={[styles.cardRow, { flexDirection: row }]}
                onPress={() => navigation.navigate('ProductDetails', { productName: item.name })}
              >
                <Image source={{ uri: buildImageUrl(item.images?.[0]) }} style={styles.image} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>
                    {formatCurrency(price)}
                  </Text>
                </View>
              </Pressable>
              <View style={[styles.actions, { flexDirection: row }]}>
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleAddCart(item)}
                >
                  <Feather name="shopping-cart" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>{tUi('ui.pages.products.addToCart_0ebb524946')}</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => handleRemove(item)}>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </CustomerScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyHint: { fontSize: 14, textAlign: 'center', maxWidth: 280 },
    card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12, ...shadow },
    cardRow: { gap: 12, alignItems: 'center' },
    image: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceAlt },
    name: { fontSize: 15, fontWeight: '700' },
    actions: { marginTop: 10, gap: 10, alignItems: 'center' },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 999,
      paddingVertical: 10,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    iconBtn: { padding: 10 },
  });

export default WishlistScreen;

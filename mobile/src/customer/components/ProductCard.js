import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import StarRating from '../../components/StarRating';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useCurrency } from '../../hooks/useCurrency';
import { useTUi } from '../../i18n/uiText';
import { buildImageUrl } from '../../admin/utils/format';

const getDiscountPercent = (product) => {
  if (!product?.discount_enabled || !product.price || !product.discounted_price) return 0;
  if (product.discounted_price >= product.price) return 0;
  return Math.round((1 - product.discounted_price / product.price) * 100);
};

const ProductCard = ({
  product,
  onPress,
  onAddCart,
  onToggleWishlist,
  isWishlisted,
  compact = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { row, textAlign } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const tUi = useTUi();

  const displayName = product?.localized_name || product?.name || '';
  const imageUri = buildImageUrl(product?.images?.[0]);
  const discountPct = getDiscountPercent(product);
  const hasDiscount = discountPct > 0;
  const price = hasDiscount ? product.discounted_price : product.price;

  return (
    <Pressable
      style={[styles.card, compact && styles.cardCompact, { borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {hasDiscount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPct}%</Text>
          </View>
        ) : null}
        {product?.localized_category_name || product?.category_name ? (
          <View style={[styles.categoryPill, { backgroundColor: colors.surface }]}>
            <Text style={[styles.categoryText, { color: colors.text }]} numberOfLines={1}>
              {product.localized_category_name || product.category_name}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text, textAlign }]} numberOfLines={2}>
          {displayName}
        </Text>
        <StarRating
          averageRating={product?.average_rating}
          totalRatings={product?.total_ratings}
          size="small"
          showLabel={!compact}
        />
        <View style={[styles.priceRow, { flexDirection: row }]}>
          <Text style={[styles.price, { color: colors.primary }]}>{formatCurrency(price)}</Text>
          {hasDiscount ? (
            <Text style={[styles.oldPrice, { color: colors.muted }]}>
              {formatCurrency(product.price)}
            </Text>
          ) : null}
        </View>
        <View style={[styles.actions, { flexDirection: row }]}>
          {onAddCart ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onAddCart();
              }}
              accessibilityLabel={tUi('ui.pages.home.addToCart_db672a40f8')}
            >
              <Feather name="shopping-cart" size={16} color="#fff" />
            </Pressable>
          ) : null}
          {onToggleWishlist ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.border }]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleWishlist();
              }}
              accessibilityLabel={
                isWishlisted
                  ? tUi('ui.pages.home.removeFromWishlist_8663e14321')
                  : tUi('ui.pages.home.addToWishlist_ace0a00bdf')
              }
            >
              <Feather
                name="heart"
                size={16}
                color={isWishlisted ? colors.danger : colors.text}
                fill={isWishlisted ? colors.danger : 'transparent'}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 150,
      maxWidth: '48%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: 12,
      ...shadow,
    },
    cardCompact: {
      maxWidth: '31%',
      minWidth: 110,
    },
    imageWrap: {
      height: 140,
      backgroundColor: colors.surfaceAlt,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    discountBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.danger,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    discountText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    categoryPill: {
      position: 'absolute',
      top: 8,
      left: 8,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: '70%',
    },
    categoryText: {
      fontSize: 10,
      fontWeight: '600',
    },
    body: {
      padding: 12,
      gap: 6,
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      minHeight: 36,
    },
    priceRow: {
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    price: {
      fontSize: 15,
      fontWeight: '700',
    },
    oldPrice: {
      fontSize: 12,
      textDecorationLine: 'line-through',
    },
    actions: {
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
    },
  });

export default ProductCard;

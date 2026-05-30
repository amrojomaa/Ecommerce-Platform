import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import ProductCard from '../components/ProductCard';
import StarRating from '../../components/StarRating';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { useCurrency } from '../../hooks/useCurrency';
import { localizeProduct } from '../../utils/localizedContent';
import { buildImageUrl } from '../../admin/utils/format';
import http from '../../services/http';
import {
  PRODUCT_ENDPOINTS,
  COMMENT_ENDPOINTS,
  RATING_ENDPOINTS,
  buildUrl,
} from '../../config/api';

const ProductDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { row, textAlign, isRtl } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const productName = route.params?.productName;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [rating, setRating] = useState({ average_rating: 0, total_ratings: 0 });
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!productName) return;
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.BY_NAME, {
        params: { name: decodeURIComponent(productName) },
      });
      if (!response.data) {
        throw new Error('Product not found');
      }
      const localized = localizeProduct(response.data, language);
      setProduct(localized);
      setSelectedImageIndex(0);
      if (localized?.id) {
        const [commentsRes, ratingRes] = await Promise.all([
          http.get(buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: localized.id })),
          http.get(buildUrl(RATING_ENDPOINTS.GET_PRODUCT, { product_id: localized.id })),
        ]);
        setComments(commentsRes.data || []);
        setRating(ratingRes.data || { average_rating: 0, total_ratings: 0 });
      }
    } catch (_) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.productDetails.productNotFound_6a7319bc51') });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [language, navigation, productName, tUi]);

  const fetchRelated = useCallback(
    async (categoryName, currentName) => {
      try {
        const endpoint = isAuthenticated ? PRODUCT_ENDPOINTS.FILTER_USER : PRODUCT_ENDPOINTS.FILTER;
        const response = await http.get(endpoint, { params: { category: categoryName } });
        const items = (response.data || [])
          .filter((item) => item.name !== currentName)
          .slice(0, 4)
          .map((p) => localizeProduct(p, language));
        setRelatedProducts(items);
      } catch (_) {
        setRelatedProducts([]);
      }
    },
    [isAuthenticated, language]
  );

  useEffect(() => {
    setProduct(null);
    setLoading(true);
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (product?.category_name) {
      fetchRelated(product.category_name, product.name);
    }
  }, [product?.category_name, product?.name, fetchRelated]);

  if (loading || !product) {
    return (
      <CustomerScreen showBack title={tUi('ui.pages.products.products_95d89e6fd4')}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </CustomerScreen>
    );
  }

  const images =
    product.images?.length > 0 ? product.images.map(buildImageUrl) : [buildImageUrl(null)];
  const inStock = (product.quantity ?? 0) > 0;
  const hasDiscount =
    product.discount_enabled && product.discounted_price < product.price;
  const displayPrice = hasDiscount ? product.discounted_price : product.price;

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0') });
      return;
    }
    setAddingToCart(true);
    const result = await addToCart(product.name, quantity);
    setAddingToCart(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.home.productAddedToCart_d4e0ddfeac') });
    } else {
      Toast.show({ type: 'error', text1: result.error || tUi('ui.pages.productDetails.failedToAddToCart_b4e8a1c2d7') });
    }
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (isInWishlist(product.name)) {
      await removeFromWishlist(product.name);
    } else {
      await addToWishlist(product);
    }
  };

  return (
    <CustomerScreen
      showBack
      scroll
      title={product.localized_name || product.name}
      subtitle={product.localized_category_name || product.category_name}
      action={
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {tUi('ui.pages.productDetails.backToProducts_349cc09ded')}
          </Text>
        </Pressable>
      }
    >
      <Image source={{ uri: images[selectedImageIndex] }} style={styles.heroImage} resizeMode="cover" />
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {images.map((uri, idx) => (
            <Pressable key={uri + idx} onPress={() => setSelectedImageIndex(idx)}>
              <Image
                source={{ uri }}
                style={[
                  styles.thumb,
                  selectedImageIndex === idx && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <StarRating
        averageRating={rating.average_rating ?? product.average_rating}
        totalRatings={rating.total_ratings ?? product.total_ratings}
        size="large"
      />

      <View style={[styles.priceRow, { flexDirection: row }]}>
        <Text style={[styles.price, { color: colors.primary }]}>{formatCurrency(displayPrice)}</Text>
        {hasDiscount ? (
          <Text style={[styles.oldPrice, { color: colors.muted }]}>{formatCurrency(product.price)}</Text>
        ) : null}
      </View>

      <Text style={[styles.stock, { color: inStock ? colors.success : colors.danger, textAlign }]}>
        {inStock ? tUi('ui.pages.productDetails.available_d8d9652e8f') : tUi('ui.pages.productDetails.outOfStock_2f92caa56c')}
      </Text>

      <View style={[styles.qtyRow, { flexDirection: row }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{tUi('ui.pages.productDetails.quantity_de67f4b600')}</Text>
        <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
          <Feather name="minus" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: '700', minWidth: 28, textAlign: 'center' }}>{quantity}</Text>
        <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
          <Feather name="plus" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.ctaRow, { flexDirection: row }]}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary }, !inStock && styles.disabled]}
          onPress={handleAddToCart}
          disabled={!inStock || addingToCart}
        >
          <Text style={styles.primaryBtnText}>
            {addingToCart ? tUi('ui.pages.productDetails.adding_257a62f16d') : tUi('ui.pages.productDetails.addToCart_39ede17f50')}
          </Text>
        </Pressable>
        <Pressable style={[styles.iconBtn, { borderColor: colors.border }]} onPress={handleWishlist}>
          <Feather
            name="heart"
            size={20}
            color={isInWishlist(product.name) ? colors.danger : colors.text}
          />
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
        {tUi('ui.pages.productDetails.description_173378af63')}
      </Text>
      <Text style={[styles.description, { color: colors.muted, textAlign }]}>
        {product.localized_description || product.description || '—'}
      </Text>

      <Pressable onPress={() => setCommentsOpen((v) => !v)}>
        <Text style={{ color: colors.primary, fontWeight: '700', marginVertical: 12 }}>
          {commentsOpen
            ? tUi('ui.pages.productDetails.hideCommentsReviews_695cb75f4d')
            : tUi('ui.pages.productDetails.openCommentsReviews_2a13485a67')}
        </Text>
      </Pressable>

      {commentsOpen ? (
        <View style={[styles.commentsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {comments.length === 0 ? (
            <Text style={{ color: colors.muted }}>—</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{c.user_name || 'User'}</Text>
                <Text style={{ color: colors.muted }}>{c.comment}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {relatedProducts.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, textAlign, marginTop: 16 }]}>
            {tUi('ui.pages.productDetails.sameCategoryTitle_b4e8a1c2d5')}
          </Text>
          <Text style={[styles.description, { color: colors.muted, textAlign, marginBottom: 8 }]}>
            {tUi('ui.pages.productDetails.sameCategorySubtitle_b4e8a1c2d6')}
          </Text>
          <View style={styles.relatedGrid}>
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                compact
                onPress={() => navigation.push('ProductDetails', { productName: p.name })}
                onAddCart={() => addToCart(p.name, 1)}
                onToggleWishlist={async () => {
                  if (isInWishlist(p.name)) await removeFromWishlist(p.name);
                  else await addToWishlist(p);
                }}
                isWishlisted={isInWishlist(p.name)}
              />
            ))}
          </View>
        </>
      ) : null}
    </CustomerScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    heroImage: { width: '100%', height: 260, borderRadius: 16, marginBottom: 10, backgroundColor: colors.surfaceAlt },
    thumbRow: { marginBottom: 12 },
    thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 8 },
    priceRow: { alignItems: 'center', gap: 10, marginVertical: 8 },
    price: { fontSize: 24, fontWeight: '700' },
    oldPrice: { fontSize: 16, textDecorationLine: 'line-through' },
    stock: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
    qtyRow: { alignItems: 'center', gap: 12, marginBottom: 16 },
    qtyBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaRow: { gap: 10, marginBottom: 16 },
    primaryBtn: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      ...shadow,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    iconBtn: {
      width: 48,
      height: 48,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.5 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    description: { fontSize: 14, lineHeight: 22, marginBottom: 8 },
    commentsBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
    commentItem: { gap: 4 },
    relatedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  });

export default ProductDetailsScreen;

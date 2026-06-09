import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import ProductCard from '../components/ProductCard';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { localizeProduct } from '../../utils/localizedContent';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, PROMOTION_ENDPOINTS } from '../../config/api';

const SORT_OPTIONS = [
  { id: 'name', labelKey: 'ui.pages.products.name_53f551ed5a' },
  { id: 'price_asc', labelKey: 'ui.pages.products.priceLowToHigh_5592424a7e' },
  { id: 'price_desc', labelKey: 'ui.pages.products.priceHighToLow_63247b2840' },
];

const PAGE_SIZE = 12;

const ProductsScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { isRtl, textAlign, row } = useRtlLayout();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [promoMessage, setPromoMessage] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const hasFilters = Boolean(searchTerm || selectedCategory);
      let fetched = [];
      if (hasFilters) {
        const endpoint = isAuthenticated ? PRODUCT_ENDPOINTS.FILTER_USER : PRODUCT_ENDPOINTS.FILTER;
        const params = {};
        if (searchTerm) params.name = searchTerm;
        if (selectedCategory) params.category = selectedCategory;
        try {
          const response = await http.get(endpoint, { params });
          fetched = response.data || [];
        } catch (error) {
          if (error.response?.status !== 404) throw error;
          fetched = [];
        }
      } else {
        const response = await http.get(PRODUCT_ENDPOINTS.ALL, {
          params: { catalog_only: true },
        });
        fetched = response.data || [];
      }
      const localized = fetched.map((p) => localizeProduct(p, language));
      setProducts(localized);
      setCategories([...new Set(localized.map((p) => p.category_name).filter(Boolean))]);
      setVisibleCount(PAGE_SIZE);
    } catch (_) {
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, language, searchTerm, selectedCategory]);

  const fetchPromo = useCallback(async () => {
    try {
      const response = await http.get(PROMOTION_ENDPOINTS.ACTIVE);
      setPromoMessage(response.data?.customer_message || '');
    } catch (_) {
      setPromoMessage('');
    }
  }, []);

  useEffect(() => {
    fetchPromo();
  }, [fetchPromo]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price_asc') {
      list.sort((a, b) => (a.discounted_price || a.price) - (b.discounted_price || b.price));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (b.discounted_price || b.price) - (a.discounted_price || a.price));
    } else {
      list.sort((a, b) =>
        (a.localized_name || a.name || '').localeCompare(b.localized_name || b.name || '')
      );
    }
    return list;
  }, [products, sortBy]);

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, visibleCount),
    [sortedProducts, visibleCount]
  );

  const resultLabel =
    sortedProducts.length === 1
      ? tUi('ui.pages.products.productFoundCount_b4e8a1c2e3', { value0: 1 })
      : tUi('ui.pages.products.productsFoundCount_b4e8a1c2e4', { value0: sortedProducts.length });

  const openProduct = (product) => {
    navigation.navigate('ProductDetails', { productName: product.name });
  };

  const handleAddCart = async (product) => {
    const result = await addToCart(product.name, 1);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.products.productAddedToCart_577eece582') });
    } else {
      Toast.show({ type: 'error', text1: result.error });
    }
  };

  const loadMore = () => {
    if (visibleCount < sortedProducts.length) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, sortedProducts.length));
    }
  };

  const listHeader = (
    <View>
      {promoMessage ? (
        <View style={[styles.promoBand, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.promoKicker, { color: colors.primary }]}>
            {tUi('ui.pages.products.promotionAvailableFallback')}
          </Text>
          <Text style={[styles.promoBody, { color: colors.text, textAlign }]}>{promoMessage}</Text>
        </View>
      ) : null}

      <TextInput
        style={[
          styles.searchInput,
          { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
          { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' },
        ]}
        placeholder={tUi('navbar.searchPlaceholder')}
        placeholderTextColor={colors.muted}
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <Pressable
          style={[styles.chip, !selectedCategory && styles.chipActive, { borderColor: colors.border }]}
          onPress={() => setSelectedCategory('')}
        >
          <Text style={{ color: !selectedCategory ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
            {tUi('ui.pages.products.allCategories_9fd1de45e8')}
          </Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.chip,
              selectedCategory === cat && styles.chipActive,
              { borderColor: colors.border, marginLeft: 8 },
            ]}
            onPress={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
          >
            <Text
              style={{
                color: selectedCategory === cat ? '#fff' : colors.text,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            style={[
              styles.sortChip,
              sortBy === opt.id && { backgroundColor: colors.primary },
              { borderColor: colors.border, marginRight: 8 },
            ]}
            onPress={() => setSortBy(opt.id)}
          >
            <Text style={{ color: sortBy === opt.id ? '#fff' : colors.text, fontSize: 12 }}>
              {tUi(opt.labelKey)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={[styles.resultCount, { color: colors.muted, textAlign }]}>{resultLabel}</Text>
    </View>
  );

  return (
    <CustomerScreen
      scroll={false}
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('ui.pages.products.products_95d89e6fd4')}
      subtitle={tUi('ui.pages.products.discoverOurAmazingCollection_79dc76c0e9')}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          style={styles.list}
          data={visibleProducts}
          keyExtractor={(item) => String(item.id || item.name)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={PAGE_SIZE}
          windowSize={5}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, textAlign }]}>
              {tUi('ui.pages.products.noProductsFoundTryAdjusting_7d5a13e1ec')}
            </Text>
          }
          ListFooterComponent={
            visibleCount < sortedProducts.length ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item: product }) => (
            <ProductCard
              product={product}
              onPress={() => openProduct(product)}
              onAddCart={() => handleAddCart(product)}
              onToggleWishlist={async () => {
                if (isInWishlist(product.name)) await removeFromWishlist(product.name);
                else await addToWishlist(product);
              }}
              isWishlisted={isInWishlist(product.name)}
            />
          )}
        />
      )}
    </CustomerScreen>
  );
};

const createStyles = ({ colors }) =>
  StyleSheet.create({
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 24,
    },
    gridRow: {
      justifyContent: 'space-between',
      gap: 8,
    },
    promoBand: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    promoKicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    promoBody: { fontSize: 14, lineHeight: 20 },
    searchInput: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 11,
      marginBottom: 12,
      fontSize: 15,
    },
    chipsScroll: { marginBottom: 10, maxHeight: 44 },
    chip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortChip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    resultCount: { fontSize: 13, marginBottom: 8 },
    empty: { marginTop: 32, fontSize: 15 },
  });

export default ProductsScreen;

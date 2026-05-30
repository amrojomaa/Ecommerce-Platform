import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import ProductCard from '../components/ProductCard';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { useLanguage } from '../../context/LanguageContext';
import { localizeProduct } from '../../utils/localizedContent';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS } from '../../config/api';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { row, textAlign } = useRtlLayout();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [loading, setLoading] = useState(true);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [discountedProducts, setDiscountedProducts] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL);
      const products = response.data || [];
      const discounts = products.filter((p) => p.discount_enabled);
      const uniqueCategories = [...new Set(products.map((p) => p.category_name))];
      setFeaturedProducts(products.slice(0, 6).map((p) => localizeProduct(p, language)));
      setDiscountedProducts(discounts.slice(0, 6).map((p) => localizeProduct(p, language)));
      setProductCount(products.length);
      setDiscountCount(discounts.length);
      setCategoryCount(uniqueCategories.length);
    } catch (_) {
      setFeaturedProducts([]);
      setDiscountedProducts([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openProduct = (product) => {
    navigation.navigate('ProductDetails', { productName: product.name });
  };

  const handleAddCart = async (product) => {
    if (!isAuthenticated) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0') });
      return;
    }
    const result = await addToCart(product.name, 1);
    if (result.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.home.productAddedToCart_d4e0ddfeac') });
    } else {
      Toast.show({ type: 'error', text1: result.error });
    }
  };

  const handleToggleWishlist = async (product) => {
    if (!isAuthenticated) return;
    if (isInWishlist(product.name)) {
      await removeFromWishlist(product.name);
    } else {
      await addToWishlist(product);
    }
  };

  const formatStat = (value) => (loading ? '…' : value > 0 ? `${value}+` : '0');

  const renderGrid = (items) => (
    <View style={styles.grid}>
      {items.map((product) => (
        <ProductCard
          key={product.id || product.name}
          product={product}
          onPress={() => openProduct(product)}
          onAddCart={() => handleAddCart(product)}
          onToggleWishlist={() => handleToggleWishlist(product)}
          isWishlisted={isInWishlist(product.name)}
        />
      ))}
    </View>
  );

  return (
    <CustomerScreen
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('ui.pages.home.welcomeToOurStore_fe0466a249')}
      subtitle={tUi('ui.pages.home.discoverAmazingProductsAtUnbeatable_e717e87b85')}
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Text style={styles.heroKicker}>{tUi('ui.pages.home.heroKicker_2e51d0c3a7')}</Text>
        <Text style={styles.heroTitle}>{tUi('ui.pages.home.welcomeToOurStore_fe0466a249')}</Text>
        <Text style={styles.heroNote}>{tUi('ui.pages.home.heroNote_1c0a3b7d12')}</Text>
        <Pressable
          style={styles.heroCta}
          onPress={() => navigation.navigate('Products')}
        >
          <Text style={styles.heroCtaText}>{tUi('ui.pages.home.shopNow_e58073dc0e')}</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </Pressable>
      </View>

      <View style={[styles.statsRow, { flexDirection: row }]}>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatStat(productCount)}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{tUi('ui.pages.products.products_95d89e6fd4')}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatStat(discountCount)}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{tUi('ui.pages.home.discounts_7c50f5ea26')}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatStat(categoryCount)}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{tUi('ui.pages.home.shopByCategory_dde1ec52b8')}</Text>
        </View>
      </View>

      <View style={styles.promoBand}>
        <Text style={[styles.promoKicker, { color: colors.primary }]}>{tUi('ui.pages.home.promoTitle_5f7b0db4da')}</Text>
        <Text style={[styles.promoBody, { color: colors.text, textAlign }]}>{tUi('ui.pages.home.promoBody_0dc5f5e2c8')}</Text>
        <Pressable onPress={() => navigation.navigate('Products')}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.home.promoCta_32bb6c9d5d')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <SectionHeader
            title={tUi('ui.pages.home.featuredProducts_666a6cab05')}
            subtitle={tUi('ui.pages.home.featuredSubtitle_6d8a2e0a4e')}
            textAlign={textAlign}
            colors={colors}
          />
          {renderGrid(featuredProducts)}

          <SectionHeader
            title={tUi('ui.pages.home.discounts_7c50f5ea26')}
            subtitle={tUi('ui.pages.home.discountsSubtitle_9a4b3d5b2f')}
            textAlign={textAlign}
            colors={colors}
          />
          {renderGrid(discountedProducts)}
        </>
      )}

      <Pressable
        style={[styles.viewAllBtn, { borderColor: colors.border }]}
        onPress={() => navigation.navigate('Products')}
      >
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.home.viewAllProducts_e59509eaba')}</Text>
      </Pressable>
    </CustomerScreen>
  );
};

const SectionHeader = ({ title, subtitle, textAlign, colors }) => (
  <View style={{ marginTop: 20, marginBottom: 12 }}>
    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign }}>{title}</Text>
    <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4, textAlign }}>{subtitle}</Text>
  </View>
);

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    hero: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      ...shadow,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    heroTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
    },
    heroNote: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      marginBottom: 14,
    },
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
    },
    heroCtaText: {
      color: '#fff',
      fontWeight: '700',
    },
    statsRow: {
      gap: 10,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 11,
      marginTop: 4,
      textAlign: 'center',
    },
    promoBand: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 8,
    },
    promoKicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    promoBody: {
      fontSize: 14,
      marginBottom: 8,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 4,
    },
    viewAllBtn: {
      marginTop: 8,
      marginBottom: 24,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    },
  });

export default HomeScreen;

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { RECOMMENDATION_ENDPOINTS } from '../../config/api';

const RecommendationsScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { textAlign } = useRtlLayout();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);

  const loadBatch = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await http.get(RECOMMENDATION_ENDPOINTS.BATCH, {
          params: { limit: 15, force_refresh: forceRefresh },
        });
        const envelopes = response.data || [];
        const mapped = envelopes
          .map((entry) => (entry.product ? localizeProduct(entry.product, language) : null))
          .filter(Boolean);
        setProducts(mapped);
        if (forceRefresh) {
          Toast.show({ type: 'success', text1: tUi('ui.pages.recommendations.batchRecommendationsRefreshed_3c588c1cd7') });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: error.response?.data?.detail || tUi('ui.pages.recommendations.failedLoadBatch_b4e8c2d408'),
        });
        setProducts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [language, tUi]
  );

  useEffect(() => {
    if (isAuthenticated) loadBatch(false);
    else setLoading(false);
  }, [isAuthenticated, loadBatch]);

  return (
    <CustomerScreen
      showBack
      title={tUi('ui.pages.recommendations.recommendedForYou_33db7a2db1')}
      subtitle={tUi('ui.pages.recommendations.batchSubtitle_b4e8c2d403')}
      action={
        <Pressable onPress={() => loadBatch(true)} disabled={refreshing}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {refreshing ? tUi('ui.pages.recommendations.loading_c951e2c5a2') : tUi('ui.pages.recommendations.recomputeNow_bac7d8c8a7')}
          </Text>
        </Pressable>
      }
    >
      {!isAuthenticated ? (
        <Text style={{ color: colors.muted, textAlign }}>{tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0')}</Text>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text, textAlign }]}>{tUi('ui.pages.recommendations.emptyTitle_b4e8c2d404')}</Text>
          <Text style={[styles.emptyBody, { color: colors.muted, textAlign }]}>
            {tUi('ui.pages.recommendations.noBatchResultsYetView_1937d58ec4')}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => navigation.navigate('ProductDetails', { productName: product.name })}
              onAddCart={async () => {
                const r = await addToCart(product.name, 1);
                if (r.success) Toast.show({ type: 'success', text1: tUi('ui.pages.products.productAddedToCart_577eece582') });
              }}
              onToggleWishlist={async () => {
                if (isInWishlist(product.name)) await removeFromWishlist(product.name);
                else await addToWishlist(product);
              }}
              isWishlisted={isInWishlist(product.name)}
            />
          ))}
        </View>
      )}
    </CustomerScreen>
  );
};

const createStyles = () =>
  StyleSheet.create({
    empty: { paddingVertical: 32, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyBody: { fontSize: 14, lineHeight: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  });

export default RecommendationsScreen;

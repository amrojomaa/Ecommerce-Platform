import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS, PRODUCT_ENDPOINTS } from '../../config/api';
import { buildImageUrl } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const WarehouseStaffProductsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { formatCurrency } = useCurrency();
  const { panelKicker } = usePanelRole();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(res.data || []);
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.warehouseStaff.warehouseStaffProducts.loadFailed_a1b2c3d4e5'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(res.data || []);
    } catch (_) {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchCategories, fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !categoryFilter || p.category_name === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, products, searchQuery]);

  const getStockStatus = (quantity) => {
    if (quantity === 0) return 'out';
    if (quantity < 10) return 'low';
    return 'ok';
  };

  const categoryBar = (
    <View style={styles.categoryWrap}>
      <Pressable
        style={[styles.categoryChip, !categoryFilter && styles.categoryChipActive]}
        onPress={() => setCategoryFilter('')}
      >
        <Text style={[styles.categoryChipText, !categoryFilter && styles.categoryChipTextActive]}>
          {tUi('ui.pages.warehouseStaff.warehouseStaffProducts.allCategories_p5q6r7s8t9')}
        </Text>
      </Pressable>
      {categories.slice(0, 4).map((category) => (
        <Pressable
          key={category.name}
          style={[styles.categoryChip, categoryFilter === category.name && styles.categoryChipActive]}
          onPress={() => setCategoryFilter(category.name)}
        >
          <Text
            style={[
              styles.categoryChipText,
              categoryFilter === category.name && styles.categoryChipTextActive,
            ]}
            numberOfLines={1}
          >
            {category.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.title_f6g7h8i9j0')}
      subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.subtitle_k1l2m3n4o5')}
      action={categoryBar}
    >
      <View style={[styles.searchWrap, { flexDirection: row }]}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.searchPlaceholder_u0v1w2x3y4')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>
          {products.length === 0
            ? tUi('ui.pages.warehouseStaff.warehouseStaffProducts.emptyNoProducts_z5a6b7c8d9')
            : tUi('ui.pages.warehouseStaff.warehouseStaffProducts.emptyNoMatch_e0f1g2h3i4')}
        </Text>
      ) : (
        filteredProducts.map((product) => {
          const imageSrc = product.images?.[0] ? buildImageUrl(product.images[0]) : null;
          const stockStatus = getStockStatus(product.quantity);
          const hasDiscount =
            product.discount_enabled && product.discounted_price < product.price;

          return (
            <View key={product.id} style={styles.productCard}>
              <View style={[styles.productTop, { flexDirection: row }]}>
                {imageSrc ? (
                  <Image source={{ uri: imageSrc }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Feather name="package" size={20} color={colors.muted} />
                  </View>
                )}
                <View style={styles.productMain}>
                  <Text style={[styles.productName, { textAlign }]} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={[styles.productMeta, { textAlign }]}>
                    {product.category_name || '—'}
                  </Text>
                  <View style={[styles.priceRow, { flexDirection: row }]}>
                    {hasDiscount ? (
                      <>
                        <Text style={styles.priceOld}>{formatCurrency(product.price)}</Text>
                        <Text style={styles.priceSale}>{formatCurrency(product.discounted_price)}</Text>
                      </>
                    ) : (
                      <Text style={styles.price}>{formatCurrency(product.price)}</Text>
                    )}
                    {product.discount_enabled ? (
                      <Text style={styles.discountBadge}>
                        {product.discount_type === 'percentage'
                          ? `${product.discount_value}%`
                          : formatCurrency(product.discount_value)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.stockWrap}>
                  <Text
                    style={[
                      styles.stockBadge,
                      stockStatus === 'out' && styles.stockOut,
                      stockStatus === 'low' && styles.stockLow,
                      stockStatus === 'ok' && styles.stockOk,
                    ]}
                  >
                    {product.quantity === 0
                      ? tUi('ui.pages.warehouseStaff.warehouseStaffProducts.stockOut_n5o6p7q8r9')
                      : product.quantity}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    categoryWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      maxWidth: 360,
    },
    categoryChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      maxWidth: 120,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    categoryChipTextActive: {
      color: '#fff',
    },
    searchWrap: {
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      height: 44,
      color: colors.text,
      fontSize: 14,
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      paddingVertical: 20,
    },
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    productTop: {
      alignItems: 'center',
      gap: 12,
    },
    productImage: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.border,
    },
    productImagePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: isDark ? colors.background : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    productMain: {
      flex: 1,
    },
    productName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    productMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    priceRow: {
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    price: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    priceOld: {
      fontSize: 12,
      color: colors.muted,
      textDecorationLine: 'line-through',
    },
    priceSale: {
      fontSize: 14,
      fontWeight: '700',
      color: '#dc2626',
    },
    discountBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: '#dc2626',
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    stockWrap: {
      alignItems: 'flex-end',
      minWidth: 44,
    },
    stockBadge: {
      fontSize: 14,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: 'hidden',
    },
    stockOk: {
      color: '#16a34a',
      backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7',
    },
    stockLow: {
      color: '#d97706',
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7',
    },
    stockOut: {
      color: '#dc2626',
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
      fontSize: 11,
    },
  });

export default WarehouseStaffProductsScreen;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
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
import {
  ADMIN_SETTINGS_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  WAREHOUSE_ENDPOINTS,
  buildUrl,
} from '../../config/api';
import { buildImageUrl } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const STOCK_FILTERS = ['', 'in', 'low', 'out'];

const WarehouseInventoryScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { formatCurrency } = useCurrency();
  const { panelKicker } = usePanelRole();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [editingStock, setEditingStock] = useState({});
  const [savingStock, setSavingStock] = useState(null);

  useEffect(() => {
    const stock = route.params?.stock;
    if (stock === 'low' || stock === 'out' || stock === 'in') {
      setStockFilter(stock);
    }
  }, [route.params?.stock]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseInventory.toast.failedToLoadProducts'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  const fetchThreshold = useCallback(async () => {
    try {
      const res = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      setLowStockThreshold(res.data.threshold);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchThreshold();
  }, [fetchProducts, fetchThreshold]);

  const formatStockFilterLabel = (value) => {
    if (value === 'in') return tUi('ui.pages.warehouse.warehouseInventory.filter.inStock');
    if (value === 'low') return tUi('ui.pages.warehouse.warehouseInventory.filter.lowStock');
    if (value === 'out') return tUi('ui.pages.warehouse.warehouseInventory.filter.outOfStock');
    return tUi('ui.pages.warehouse.warehouseInventory.filter.all');
  };

  const getStockStatus = (qty) => {
    if (qty === 0) return 'out-of-stock';
    if (qty < lowStockThreshold) return 'low-stock';
    return 'in-stock';
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesStock = true;
      if (stockFilter === 'low') matchesStock = p.quantity > 0 && p.quantity < lowStockThreshold;
      else if (stockFilter === 'out') matchesStock = p.quantity === 0;
      else if (stockFilter === 'in') matchesStock = p.quantity >= lowStockThreshold;
      return matchesSearch && matchesStock;
    });
  }, [lowStockThreshold, products, searchQuery, stockFilter]);

  const handleStockChange = (productId, value) => {
    setEditingStock((prev) => ({ ...prev, [productId]: value }));
  };

  const handleSaveStock = async (productId) => {
    const newQty = parseInt(editingStock[productId], 10);
    if (Number.isNaN(newQty) || newQty < 0) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.warehouse.warehouseInventory.toast.invalidQuantity'),
      });
      return;
    }
    setSavingStock(productId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.UPDATE_STOCK, { product_id: productId }), {
        quantity: newQty,
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.warehouse.warehouseInventory.toast.stockUpdated'),
      });
      setEditingStock((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      fetchProducts();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseInventory.toast.failedToUpdateStock'),
      });
    } finally {
      setSavingStock(null);
    }
  };

  const productCountLabel =
    filteredProducts.length === 1
      ? tUi('ui.pages.warehouse.warehouseInventory.productCountOne')
      : tUi('ui.pages.warehouse.warehouseInventory.productCountMany');

  const filterBar = (
    <View style={styles.filterWrap}>
      <View style={styles.filterRow}>
        {STOCK_FILTERS.map((value) => (
          <Pressable
            key={value || 'all'}
            style={[styles.filterChip, stockFilter === value && styles.filterChipActive]}
            onPress={() => setStockFilter(value)}
          >
            <Text style={[styles.filterChipText, stockFilter === value && styles.filterChipTextActive]}>
              {formatStockFilterLabel(value)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.countMeta}>
        <Text style={styles.countStrong}>{filteredProducts.length}</Text> {productCountLabel}
      </Text>
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouse.warehouseInventory.title')}
      subtitle={tUi('ui.pages.warehouse.warehouseInventory.subtitle')}
      action={filterBar}
    >
      <View style={[styles.searchWrap, { flexDirection: row }]}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.warehouse.warehouseInventory.searchPlaceholder')}
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
          {tUi('ui.pages.warehouse.warehouseInventory.empty')}
        </Text>
      ) : (
        filteredProducts.map((product) => {
          const isEditing = editingStock[product.id] !== undefined;
          const imageSrc = product.images?.[0] ? buildImageUrl(product.images[0]) : null;
          const stockStatus = getStockStatus(product.quantity);
          const editedQty = editingStock[product.id];
          const showSave =
            isEditing && parseInt(editedQty, 10) !== product.quantity && editedQty !== '';

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
                    {product.category_name || '—'} · {formatCurrency(product.price)}
                  </Text>
                  <Text
                    style={[
                      styles.stockBadge,
                      stockStatus === 'out-of-stock' && styles.stockBadgeOut,
                      stockStatus === 'low-stock' && styles.stockBadgeLow,
                      stockStatus === 'in-stock' && styles.stockBadgeIn,
                    ]}
                  >
                    {tUi(`ui.pages.warehouse.warehouseInventory.status.${stockStatus}`)}
                  </Text>
                </View>
              </View>

              <View style={[styles.stockRow, { flexDirection: row }]}>
                <Text style={styles.stockLabel}>
                  {tUi('ui.pages.warehouse.warehouseInventory.table.stock')}
                </Text>
                <TextInput
                  style={[styles.stockInput, inputRtlStyle]}
                  keyboardType="number-pad"
                  value={isEditing ? String(editingStock[product.id]) : String(product.quantity)}
                  onChangeText={(value) => handleStockChange(product.id, value)}
                  onFocus={() => {
                    if (!isEditing) handleStockChange(product.id, String(product.quantity));
                  }}
                />
                {showSave ? (
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => handleSaveStock(product.id)}
                    disabled={savingStock === product.id}
                  >
                    <Text style={styles.saveButtonText}>
                      {savingStock === product.id
                        ? tUi('ui.pages.warehouse.warehouseInventory.button.saving')
                        : tUi('ui.pages.warehouse.warehouseInventory.button.save')}
                    </Text>
                  </Pressable>
                ) : null}
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
    filterWrap: {
      alignItems: 'flex-end',
      maxWidth: 360,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      marginBottom: 6,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    filterChipTextActive: {
      color: '#fff',
    },
    countMeta: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'right',
    },
    countStrong: {
      fontWeight: '700',
      color: colors.text,
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
      marginBottom: 12,
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
    stockBadge: {
      alignSelf: 'flex-start',
      marginTop: 8,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    stockBadgeIn: {
      color: '#16a34a',
      backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7',
    },
    stockBadgeLow: {
      color: '#d97706',
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7',
    },
    stockBadgeOut: {
      color: '#dc2626',
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
    },
    stockRow: {
      alignItems: 'center',
      gap: 10,
    },
    stockLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    stockInput: {
      flex: 1,
      height: 42,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 15,
      maxWidth: 120,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
    },
  });

export default WarehouseInventoryScreen;

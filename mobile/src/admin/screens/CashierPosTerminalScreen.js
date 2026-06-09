import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS, POS_ENDPOINTS } from '../../config/api';
import { buildImageUrl, formatTime } from '../utils/format';
import { localizeCategoryName, localizeProduct } from '../../utils/localizedContent';

const CashierPosTerminalScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { formatCurrency } = useCurrency();
  const { language } = useLanguage();
  const { isRtl, textAlign, row, writingDirection } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection };

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [promotionSummary, setPromotionSummary] = useState({
    subtotal: 0,
    promotion_discount: 0,
    grand_total: 0,
    applied_promotion: null,
  });

  const resolveProductName = useCallback(
    (productId, fallbackName = '') => {
      const product = catalog.find((item) => item.id === productId);
      if (product) {
        return localizeProduct(product, language).localized_name || fallbackName;
      }
      return fallbackName;
    },
    [catalog, language]
  );

  const formatPaymentMethod = (method) => {
    if (method === 'cash') return tUi('ui.pages.cashier.posTerminal.cash_3c02cb4939');
    if (method === 'card') return tUi('ui.pages.cashier.posTerminal.card_b06f050926');
    return method || '—';
  };

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const { data } = await http.get(POS_ENDPOINTS.PRODUCTS, {
        params: { q: search.trim(), category: category.trim() },
      });
      setCatalog(Array.isArray(data) ? data : []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.cashier.posTerminal.couldNotLoadProducts_f1a2b3c4d5'),
      });
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [category, search, tUi]);

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const { data } = await http.get(POS_ENDPOINTS.SALES_TODAY);
      setTodaySales(Array.isArray(data) ? data : []);
    } catch (_) {
      setTodaySales([]);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await http.get(CATEGORY_ENDPOINTS.ALL);
      const sorted = (Array.isArray(data) ? data : [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllCategories(sorted);
    } catch (_) {
      setAllCategories([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchCatalog(), 300);
    return () => clearTimeout(timer);
  }, [fetchCatalog]);

  useEffect(() => {
    fetchToday();
    fetchCategories();
  }, [fetchCategories, fetchToday]);

  useEffect(() => {
    if (lines.length === 0) {
      setShowPaymentStep(false);
    }
  }, [lines.length]);

  const todayRevenue = useMemo(
    () => todaySales.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0),
    [todaySales]
  );

  const addProduct = (product) => {
    if (product.quantity < 1) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.cashier.posTerminal.outOfStock_1bf2a299b1') });
      return;
    }
    const localized = localizeProduct(product, language);
    setLines((prev) => {
      const index = prev.findIndex((row) => row.product_id === product.id);
      if (index >= 0) {
        const next = [...prev];
        const row = next[index];
        if (row.quantity + 1 > product.quantity) {
          Toast.show({
            type: 'info',
            text1: tUi('ui.pages.cashier.posTerminal.stockLimitedForProduct_f1a2b3c4d6', {
              value0: product.quantity,
              value1: resolveProductName(product.id, product.name),
            }),
          });
          return prev;
        }
        next[index] = { ...row, quantity: row.quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: localized.localized_name || product.name,
          unit: product.discounted_price,
          maxStock: product.quantity,
          quantity: 1,
        },
      ];
    });
  };

  const adjustQty = (productId, delta) => {
    setLines((prev) =>
      prev.map((row) => {
        if (row.product_id !== productId) return row;
        let newQty = row.quantity + delta;
        if (newQty < 1) newQty = 1;
        if (newQty > row.maxStock) {
          Toast.show({
            type: 'info',
            text1: tUi('ui.pages.cashier.posTerminal.quantityCappedForProduct_f1a2b3c4d7', {
              value0: row.maxStock,
              value1: resolveProductName(row.product_id, row.name),
            }),
          });
          newQty = row.maxStock;
        }
        return { ...row, quantity: newQty };
      })
    );
  };

  const removeLine = (productId) => {
    setLines((prev) => prev.filter((row) => row.product_id !== productId));
  };

  const refreshPromotionPreview = useCallback(
    async (currentLines) => {
      if (!currentLines.length) {
        setPromotionSummary({
          subtotal: 0,
          promotion_discount: 0,
          grand_total: 0,
          applied_promotion: null,
        });
        return;
      }
      try {
        const { data } = await http.post(POS_ENDPOINTS.PROMOTION_PREVIEW, {
          items: currentLines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        });
        setPromotionSummary({
          subtotal: Number(data?.subtotal || 0),
          promotion_discount: Number(data?.promotion_discount || 0),
          grand_total: Number(data?.grand_total || 0),
          applied_promotion: data?.applied_promotion || null,
        });
      } catch (_) {
        const fallbackSubtotal = currentLines.reduce((sum, row) => sum + row.unit * row.quantity, 0);
        setPromotionSummary({
          subtotal: fallbackSubtotal,
          promotion_discount: 0,
          grand_total: fallbackSubtotal,
          applied_promotion: null,
        });
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => refreshPromotionPreview(lines), 250);
    return () => clearTimeout(timer);
  }, [lines, refreshPromotionPreview]);

  const completeSale = async (method) => {
    setSubmitting(true);
    try {
      const { data } = await http.post(POS_ENDPOINTS.SALE, {
        items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        payment_method: method,
        customer_name: customerName || null,
      });
      const saved = Number(data?.promotion_discount || 0);
      if (saved > 0) {
        Toast.show({
          type: 'success',
          text1: tUi('ui.pages.cashier.posTerminal.promotionSavedAmount_f1a2b3c4d8', {
            value0: formatCurrency(saved),
          }),
        });
      } else {
        Toast.show({
          type: 'success',
          text1: tUi('ui.pages.cashier.posTerminal.saleCompleted_09843ea178'),
        });
      }
      setLines([]);
      setCustomerName('');
      setShowPaymentStep(false);
      fetchToday();
      fetchCatalog();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.cashier.posTerminal.saleFailed_f1a2b3c4d9'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteClick = () => {
    if (lines.length === 0) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.cashier.posTerminal.addItemsToTheSale_5c282636c6') });
      return;
    }
    setShowPaymentStep(true);
  };

  const lineCount = lines.reduce((sum, row) => sum + row.quantity, 0);
  const previewGrandTotal = promotionSummary.grand_total;

  const renderProduct = ({ item: product }) => {
    const localized = localizeProduct(product, language);
    const imageSrc = product.images?.[0] ? buildImageUrl(product.images[0]) : null;
    const outOfStock = product.quantity < 1;

    return (
      <Pressable
        style={[styles.productCard, outOfStock && styles.productCardDisabled]}
        onPress={() => addProduct(product)}
        disabled={outOfStock}
      >
        <View style={styles.productThumb}>
          {imageSrc ? (
            <Image source={{ uri: imageSrc }} style={styles.productImage} />
          ) : (
            <Text style={styles.noImageText}>{tUi('ui.pages.cashier.posTerminal.noImage_bbc5075c44')}</Text>
          )}
          {outOfStock ? (
            <View style={styles.outBadge}>
              <Text style={styles.outBadgeText}>
                {tUi('ui.pages.cashier.posTerminal.outOfStock_1bf2a299b1')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.productName, { textAlign }]} numberOfLines={2}>
          {localized.localized_name}
        </Text>
        <View style={[styles.productFooter, { flexDirection: row }]}>
          <Text style={styles.productPrice}>{formatCurrency(product.discounted_price)}</Text>
          <Text style={styles.productStock}>
            {tUi('ui.pages.cashier.posTerminal.stock_968b5e6ede')}
            {product.quantity}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.catalogSection}>
          <View style={[styles.topBar, { flexDirection: row }]}>
            <View style={[styles.searchWrap, { flexDirection: row }]}>
              <Feather name="search" size={18} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, inputRtlStyle]}
                placeholder={tUi('ui.pages.cashier.posTerminal.searchByName_1a90c9550d')}
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <Pressable style={styles.historyButton} onPress={() => setShowHistoryModal(true)}>
              <Feather name="clock" size={18} color={colors.primary} />
            </Pressable>
          </View>

          <View style={[styles.metaRow, { flexDirection: row }]}>
            <Text style={[styles.metaText, { textAlign }]}>
              {tUi('ui.pages.cashier.posTerminal.productsAvailable_g7h8i9j0k1', { count: catalog.length })}
            </Text>
            <Text style={[styles.metaText, { textAlign }]}>
              {tUi('ui.pages.cashier.posTerminal.todaysRevenue_a1b2c3d4e5')}:{' '}
              <Text style={styles.revenueStrong}>{formatCurrency(todayRevenue)}</Text>
            </Text>
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            direction={isRtl ? 'rtl' : 'ltr'}
            style={styles.categoryScroll}
            contentContainerStyle={[styles.categoryRow, { flexDirection: row }]}
          >
            <View style={styles.categoryChipWrap}>
              <Pressable
                style={[styles.categoryChip, category === '' && styles.categoryChipActive]}
                onPress={() => setCategory('')}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === '' && styles.categoryChipTextActive,
                    { writingDirection },
                  ]}
                >
                  {tUi('ui.pages.cashier.posTerminal.allCategories_0c74d6af15')}
                </Text>
              </Pressable>
            </View>
            {allCategories.map((cat) => (
              <View key={cat.id} style={styles.categoryChipWrap}>
                <Pressable
                  style={[styles.categoryChip, category === cat.name && styles.categoryChipActive]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.name && styles.categoryChipTextActive,
                      { writingDirection },
                    ]}
                  >
                    {localizeCategoryName(cat, language)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {loadingCatalog ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : catalog.length === 0 ? (
            <View style={styles.emptyCatalog}>
              <Feather name="package" size={32} color={colors.muted} />
              <Text style={[styles.emptyText, { textAlign }]}>
                {tUi('ui.pages.cashier.posTerminal.noProductsFound_f6a7b8c9d0')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={catalog}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderProduct}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <View style={styles.cartPanel}>
          <View style={[styles.cartHeader, { flexDirection: row }]}>
            <View style={[styles.cartTitleRow, { flexDirection: row }]}>
              <Text style={styles.cartTitle}>
                {tUi('ui.pages.cashier.posTerminal.currentSale_53867b9445')}
              </Text>
              {lineCount > 0 ? <Text style={styles.lineCountBadge}>{lineCount}</Text> : null}
            </View>
            <TextInput
              style={[styles.customerInput, inputRtlStyle]}
              placeholder={tUi('ui.pages.cashier.posTerminal.customerNameOptional_e1f2a3b4c5')}
              placeholderTextColor={colors.muted}
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>

          <ScrollView style={styles.cartBody} contentContainerStyle={styles.cartBodyContent}>
            {lines.length === 0 ? (
              <Text style={[styles.emptyCart, { textAlign }]}>
                {tUi('ui.pages.cashier.posTerminal.tapProductsToAddLines_b80cc10ecb')}
              </Text>
            ) : (
              lines.map((row) => (
                <View key={row.product_id} style={styles.lineItem}>
                  <View style={[styles.lineTop, { flexDirection: row }]}>
                    <View style={styles.lineInfo}>
                      <Text style={[styles.lineName, { textAlign }]} numberOfLines={2}>
                        {resolveProductName(row.product_id, row.name)}
                      </Text>
                      <Text style={[styles.lineUnit, { textAlign }]}>
                        {formatCurrency(row.unit)}
                        {tUi('ui.pages.cashier.posTerminal.each_6bbbc233de')}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeLine(row.product_id)} hitSlop={8}>
                      <Feather name="x" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                  <View style={[styles.lineBottom, { flexDirection: row }]}>
                    <View style={[styles.qtyControls, { flexDirection: row }]}>
                      <Pressable style={styles.qtyBtn} onPress={() => adjustQty(row.product_id, -1)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyDisplay}>{row.quantity}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => adjustQty(row.product_id, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.lineTotal}>{formatCurrency(row.unit * row.quantity)}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.cartFooter}>
            {promotionSummary.promotion_discount > 0 ? (
              <View style={[styles.summaryRow, { flexDirection: row }]}>
                <Text style={styles.summaryLabel}>
                  {tUi('ui.pages.cashier.posTerminal.promotion_1c2c8ebd71')}
                </Text>
                <Text style={styles.promoValue}>-{formatCurrency(promotionSummary.promotion_discount)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, { flexDirection: row }]}>
              <Text style={styles.totalLabel}>{tUi('ui.pages.cashier.posTerminal.total_2fbdddbccd')}</Text>
              <Text style={styles.totalValue}>{formatCurrency(previewGrandTotal)}</Text>
            </View>

            {showPaymentStep ? (
              <View style={styles.paymentMethods}>
                <View style={[styles.payRow, { flexDirection: row }]}>
                  <Pressable
                    style={styles.payMethod}
                    onPress={() => completeSale('cash')}
                    disabled={submitting}
                  >
                    <Feather name="dollar-sign" size={18} color="#fff" />
                    <Text style={styles.payMethodText}>
                      {tUi('ui.pages.cashier.posTerminal.cash_3c02cb4939')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.payMethod}
                    onPress={() => completeSale('card')}
                    disabled={submitting}
                  >
                    <Feather name="credit-card" size={18} color="#fff" />
                    <Text style={styles.payMethodText}>
                      {tUi('ui.pages.cashier.posTerminal.card_b06f050926')}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.paymentBack}
                  onPress={() => setShowPaymentStep(false)}
                  disabled={submitting}
                >
                  <Text style={styles.paymentBackText}>
                    {tUi('ui.context.confirmContext.cancel_c50fab1ce7')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.completeButton, (submitting || lines.length === 0) && styles.completeButtonDisabled]}
                onPress={handleCompleteClick}
                disabled={submitting || lines.length === 0}
              >
                <Text style={styles.completeButtonText}>
                  {submitting
                    ? tUi('ui.pages.cashier.posTerminal.processing_94fb04c5f3')
                    : tUi('ui.pages.cashier.posTerminal.completeSale_1b0458b1b4')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={showHistoryModal}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={[styles.modalHeader, { flexDirection: row }]}>
            <Text style={styles.modalTitle}>
              {tUi('ui.pages.cashier.posTerminal.mySalesToday_69ede91d75')}
            </Text>
            <Pressable onPress={() => setShowHistoryModal(false)} hitSlop={12}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          {loadingToday ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : todaySales.length === 0 ? (
            <Text style={[styles.emptyText, { textAlign, padding: 20 }]}>
              {tUi('ui.pages.cashier.posTerminal.noPosSalesYetToday_18d914dd0f')}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={styles.historyList}>
              {todaySales.map((sale) => (
                <View key={sale.id} style={styles.historyRow}>
                  <View style={[styles.historyTop, { flexDirection: row }]}>
                    <Text style={styles.historyOrder}>
                      {tUi('ui.pages.cashier.posTerminal.order_38c040619b')} #{sale.id}
                    </Text>
                    <Text style={styles.historyTotal}>{formatCurrency(sale.total_amount)}</Text>
                  </View>
                  <View style={[styles.historyMeta, { flexDirection: row }]}>
                    <Text style={styles.historyMetaText}>{formatTime(sale.created_at)}</Text>
                    <Text style={styles.historyMetaText}>{formatPaymentMethod(sale.payment_method)}</Text>
                  </View>
                  <Text style={[styles.historyCustomer, { textAlign }]}>
                    {sale.customer_name || tUi('ui.pages.cashier.posTerminal.walkIn_c0d1e2f3a4')}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    catalogSection: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    topBar: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    searchWrap: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      height: 42,
      color: colors.text,
      fontSize: 14,
    },
    historyButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaRow: {
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    metaText: {
      fontSize: 12,
      color: colors.muted,
      flexShrink: 1,
    },
    revenueStrong: {
      fontWeight: '700',
      color: colors.text,
    },
    categoryScroll: {
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 8,
      minHeight: 38,
    },
    categoryRow: {
      alignItems: 'center',
      paddingBottom: 4,
    },
    categoryChipWrap: {
      flexShrink: 0,
      flexGrow: 0,
      marginEnd: 8,
    },
    categoryChip: {
      flexShrink: 0,
      flexGrow: 0,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 0,
      includeFontPadding: false,
      textAlign: 'center',
    },
    categoryChipTextActive: {
      color: '#fff',
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
    emptyCatalog: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 24,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
    },
    productList: {
      paddingBottom: 8,
    },
    productRow: {
      justifyContent: 'space-between',
      gap: 10,
    },
    productCard: {
      flex: 1,
      maxWidth: '48%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      marginBottom: 10,
      ...shadow,
    },
    productCardDisabled: {
      opacity: 0.55,
    },
    productThumb: {
      height: 88,
      borderRadius: 10,
      backgroundColor: isDark ? colors.background : '#F1F5F9',
      overflow: 'hidden',
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    noImageText: {
      fontSize: 11,
      color: colors.muted,
    },
    outBadge: {
      position: 'absolute',
      bottom: 6,
      alignSelf: 'center',
      backgroundColor: 'rgba(220,38,38,0.9)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    outBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
    productName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      minHeight: 34,
    },
    productFooter: {
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    productStock: {
      fontSize: 11,
      color: colors.muted,
    },
    cartPanel: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      maxHeight: '46%',
      minHeight: 220,
      ...shadow,
    },
    cartHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    cartTitleRow: {
      alignItems: 'center',
      gap: 8,
    },
    cartTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    lineCountBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      color: '#fff',
      textAlign: 'center',
      lineHeight: 22,
      fontSize: 12,
      fontWeight: '700',
      paddingHorizontal: 6,
      overflow: 'hidden',
    },
    customerInput: {
      flex: 1,
      minWidth: 120,
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 12,
      color: colors.text,
      fontSize: 13,
    },
    cartBody: {
      flex: 1,
    },
    cartBodyContent: {
      paddingHorizontal: 14,
      paddingBottom: 8,
    },
    emptyCart: {
      color: colors.muted,
      fontSize: 13,
      paddingVertical: 12,
    },
    lineItem: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    lineTop: {
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    lineInfo: {
      flex: 1,
    },
    lineName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    lineUnit: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    lineBottom: {
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    qtyControls: {
      alignItems: 'center',
      gap: 8,
    },
    qtyBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.background : '#fff',
    },
    qtyBtnText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    qtyDisplay: {
      minWidth: 24,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    lineTotal: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cartFooter: {
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    summaryRow: {
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    promoValue: {
      fontSize: 13,
      fontWeight: '700',
      color: '#16a34a',
    },
    totalRow: {
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    completeButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    completeButtonDisabled: {
      opacity: 0.55,
    },
    completeButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    paymentMethods: {
      gap: 8,
    },
    payRow: {
      gap: 10,
    },
    payMethod: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 12,
    },
    payMethodText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    paymentBack: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    paymentBackText: {
      color: colors.muted,
      fontWeight: '600',
    },
    modalSafe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    historyList: {
      padding: 16,
      gap: 10,
    },
    historyRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      ...shadow,
    },
    historyTop: {
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyOrder: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    historyTotal: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    historyMeta: {
      justifyContent: 'space-between',
      marginTop: 6,
    },
    historyMetaText: {
      fontSize: 12,
      color: colors.muted,
    },
    historyCustomer: {
      marginTop: 4,
      fontSize: 13,
      color: colors.text,
    },
  });

export default CashierPosTerminalScreen;

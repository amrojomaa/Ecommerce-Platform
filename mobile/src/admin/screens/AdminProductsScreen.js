import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTUi } from '../../i18n/uiText';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import http from '../../services/http';
import {
  ADMIN_SETTINGS_ENDPOINTS,
  CATEGORY_ENDPOINTS,
  COMMENT_ENDPOINTS,
  IMAGE_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  buildUrl,
} from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { buildImageUrl } from '../utils/format';
import { confirmAction } from '../utils/confirm';

const emptyForm = {
  name: '',
  name_ar: '',
  name_fr: '',
  description: '',
  description_ar: '',
  description_fr: '',
  price: '',
  quantity: '',
  category_name: '',
  discount_enabled: false,
  discount_type: 'percentage',
  discount_value: '',
};

const DEFAULT_ANALYTICS = {
  total_reviews: 0,
  positive_count: 0,
  neutral_count: 0,
  negative_count: 0,
};

const getFirstImage = (product) => {
  if (Array.isArray(product.images) && product.images.length) return product.images[0];
  return product.image || product.image_path || '';
};

const normalizeProductImages = (product) => {
  if (Array.isArray(product.images)) return product.images.filter(Boolean);
  return [product.image, product.image_path].filter(Boolean);
};

const AdminProductsScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const { formatCurrency } = useCurrency();
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sentimentAnalytics, setSentimentAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ lowStock: false, discounted: false });
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]);

  const fetchLowStockThreshold = useCallback(async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      setLowStockThreshold(response.data.threshold || 10);
    } catch (_) {
      setLowStockThreshold(10);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(response.data || []);
    } catch (_) {
      setCategories([]);
    }
  }, []);

  const fetchSentimentAnalytics = useCallback(async (productsToAnalyze) => {
    if (!productsToAnalyze.length) {
      setSentimentAnalytics({});
      return;
    }

    const analytics = {};
    const chunkSize = 100;

    try {
      for (let index = 0; index < productsToAnalyze.length; index += chunkSize) {
        const chunk = productsToAnalyze.slice(index, index + chunkSize);
        const productIds = chunk.map((product) => product.id).filter(Boolean).join(',');
        if (!productIds) continue;

        const response = await http.get(COMMENT_ENDPOINTS.SENTIMENT_ANALYTICS_BULK, {
          params: { product_ids: productIds },
        });

        (response.data || []).forEach((item) => {
          analytics[item.product_id] = item;
        });
      }

      productsToAnalyze.forEach((product) => {
        if (product.id && !analytics[product.id]) {
          analytics[product.id] = { ...DEFAULT_ANALYTICS, product_id: product.id };
        }
      });
    } catch (_) {
      productsToAnalyze.forEach((product) => {
        if (product.id) {
          analytics[product.id] = { ...DEFAULT_ANALYTICS, product_id: product.id };
        }
      });
    }

    setSentimentAnalytics(analytics);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const fetchedProducts = response.data || [];
      setAllProducts(fetchedProducts);
      await fetchSentimentAnalytics(fetchedProducts);
    } finally {
      setLoading(false);
    }
  }, [fetchSentimentAnalytics]);

  useEffect(() => {
    fetchLowStockThreshold();
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchLowStockThreshold, fetchProducts]);

  const products = useMemo(() => {
    let items = [...allProducts];
    if (filters.lowStock) {
      items = items.filter((product) => Number(product.quantity || 0) < lowStockThreshold);
    }
    if (filters.discounted) {
      items = items.filter((product) => product.discount_enabled);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      items = items.filter(
        (product) =>
          product.name?.toLowerCase().includes(query) ||
          product.category_name?.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query)
      );
    }
    return items;
  }, [allProducts, filters, lowStockThreshold, searchQuery]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === expandedProductId) || null,
    [expandedProductId, products]
  );

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setImages([]);
    setEditingProduct(null);
    setShowModal(false);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImages([]);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      name_ar: product.name_ar || '',
      name_fr: product.name_fr || '',
      description: product.description || '',
      description_ar: product.description_ar || '',
      description_fr: product.description_fr || '',
      price: String(product.price ?? ''),
      quantity: String(product.quantity ?? ''),
      category_name: product.category_name || '',
      discount_enabled: Boolean(product.discount_enabled),
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value ? String(product.discount_value) : '',
    });
    setImages(normalizeProductImages(product));
    setShowModal(true);
  };

  const uploadPickedImage = async (asset) => {
    const filename = asset.fileName || asset.uri.split('/').pop() || `product-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = asset.mimeType || (match ? `image/${match[1]}` : 'image/jpeg');
    const uploadData = new FormData();
    uploadData.append('image', {
      uri: asset.uri,
      name: filename,
      type,
    });
    const response = await http.post(IMAGE_ENDPOINTS.UPLOAD, uploadData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.filename;
  };

  const handlePickImages = async () => {
    if (images.length >= 3) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowed_071181eac3') });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.photoPermission') });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 3 - images.length,
    });

    if (result.canceled) return;

    const assets = result.assets || [];
    if (images.length + assets.length > 3) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowed_071181eac3') });
      return;
    }

    setUploading(true);
    try {
      const uploadedImages = await Promise.all(assets.map(uploadPickedImage));
      setImages((prev) => [...prev, ...uploadedImages]);
      Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminProducts.imagesUploadedSuccessfully_fee7383b18') });
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || tUi('ui.pages.admin.adminProducts.failedToUploadImages_f707ddb8e2') });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  const validateForm = () => {
    const price = Number.parseFloat(form.price);
    const quantity = Number.parseInt(form.quantity, 10);
    const discountValue = Number.parseFloat(form.discount_value);

    if (!form.name.trim() || !form.description.trim() || !form.category_name.trim()) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.validationRequiredFields') });
      return false;
    }
    if (Number.isNaN(price) || price <= 0) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.validationPrice') });
      return false;
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.validationQuantity') });
      return false;
    }
    if (images.length < 1 || images.length > 3) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.validationImages') });
      return false;
    }
    if (form.discount_enabled) {
      if (!['percentage', 'fixed'].includes(form.discount_type)) {
        Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.pleaseSelectAValidDiscount_b85b304c81') });
        return false;
      }
      if (Number.isNaN(discountValue) || discountValue <= 0) {
        Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.discountValueIsRequiredWhen_7037da0d1a') });
        return false;
      }
      if (form.discount_type === 'percentage' && discountValue > 100) {
        Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.percentageDiscountCannotBeMore_fa2e324b58') });
        return false;
      }
      if (form.discount_type === 'fixed' && discountValue > price) {
        Toast.show({ type: 'error', text1: tUi('ui.pages.admin.adminProducts.fixedDiscountCannotExceedThe_499b7ac30a') });
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = {
      ...form,
      price: Number.parseFloat(form.price),
      quantity: Number.parseInt(form.quantity, 10),
      discount_enabled: Boolean(form.discount_enabled),
      discount_type: form.discount_enabled ? form.discount_type : null,
      discount_value: form.discount_enabled ? Number.parseFloat(form.discount_value) : 0,
      images,
    };

    setSaving(true);
    try {
      if (editingProduct) {
        await http.put(buildUrl(PRODUCT_ENDPOINTS.UPDATE, { id: editingProduct.id }), payload);
        Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminProducts.productUpdatedSuccessfully_32fdf252d5') });
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, payload);
        Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminProducts.productCreatedSuccessfully_132827050a') });
      }
      resetForm();
      await fetchProducts();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || tUi('ui.toast.operationFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminProducts.deleteProduct_5d6cc29a29'),
      tUi('ui.pages.admin.adminProducts.areYouSureYouWant_4733cf098f'),
      tUi('ui.pages.admin.adminProducts.deleteProduct_5d6cc29a29'),
      tUi('ui.pages.admin.adminProducts.cancel_bf8eef7581')
    );
    if (!ok) return;
    try {
      await http.delete(buildUrl(PRODUCT_ENDPOINTS.DELETE, { id: product.id }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminProducts.productDeletedSuccessfully_f5f852a577') });
      setExpandedProductId(null);
      await fetchProducts();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || tUi('ui.mobile.adminProducts.failedDelete') });
    }
  };

  const calculateDiscountedPrice = (product) => {
    if (!product.discount_enabled) return product.price;
    if (typeof product.discounted_price === 'number') return product.discounted_price;
    if (product.discount_type === 'percentage') {
      return product.price - product.price * ((product.discount_value || 0) / 100);
    }
    if (product.discount_type === 'fixed') {
      return Math.max(0, product.price - (product.discount_value || 0));
    }
    return product.price;
  };

  const getSentimentSummary = (productId) => {
    const analytics = sentimentAnalytics[productId] || DEFAULT_ANALYTICS;
    const total = analytics.total_reviews || 0;
    const positiveRate = total > 0 ? Math.round((analytics.positive_count / total) * 100) : 0;
    return { ...analytics, positiveRate, total_reviews: total };
  };

  const selectedSentiment = selectedProduct ? getSentimentSummary(selectedProduct.id) : null;

  return (
    <AdminScreen
      title={tUi('ui.pages.admin.adminProducts.manageProducts_273cb9a998')}
      subtitle={tUi('ui.pages.admin.adminProducts.trackInventoryUpdateDetailsAnd_86a8fb17ed')}
      action={
        <Pressable style={[styles.primaryButton, { flexDirection: row }]} onPress={openCreate}>
          <Feather name="plus" size={16} color={colors.surface} />
          <Text style={styles.primaryButtonText}>{tUi('ui.pages.admin.adminProducts.addProduct_2792a039d2')}</Text>
        </Pressable>
      }
    >
      <View style={[styles.searchRow, { flexDirection: row }]}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.admin.adminProducts.searchProducts_ab5d94763a')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={[styles.filterRow, { flexDirection: row }]}>
        <Pressable
          style={[styles.filterChip, filters.lowStock && styles.filterChipActive]}
          onPress={() => setFilters((prev) => ({ ...prev, lowStock: !prev.lowStock }))}
        >
          <Text style={[styles.filterText, filters.lowStock && styles.filterTextActive]}>
            {tUi('ui.mobile.adminProducts.lowStock')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filters.discounted && styles.filterChipActive]}
          onPress={() => setFilters((prev) => ({ ...prev, discounted: !prev.discounted }))}
        >
          <Text style={[styles.filterText, filters.discounted && styles.filterTextActive]}>
            {tUi('ui.mobile.adminProducts.discounted')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {products.map((product) => {
            const stockLabel = Number(product.quantity || 0) < lowStockThreshold
              ? tUi('ui.mobile.adminProducts.lowStock')
              : tUi('ui.mobile.adminProducts.inStock');
            const statusTone = Number(product.quantity || 0) < lowStockThreshold ? 'warning' : 'success';
            const imagePath = getFirstImage(product);
            const categoryLabel = product.category_name || tUi('ui.mobile.adminProducts.uncategorized');
            const stockMeta = `${product.quantity || 0} ${tUi('ui.mobile.adminProducts.units')}`;
            return (
              <AdminListItem
                key={product.id}
                title={product.name}
                subtitle={product.description}
                meta={`${formatCurrency(calculateDiscountedPrice(product))} | ${categoryLabel} | ${stockMeta}`}
                status={stockLabel}
                statusTone={statusTone}
                onPress={() => setExpandedProductId((prev) => (prev === product.id ? null : product.id))}
                right={
                  <View style={styles.productRight}>
                    {imagePath ? <Image source={{ uri: buildImageUrl(imagePath) }} style={styles.thumbnail} /> : null}
                    {product.discount_enabled ? <Text style={styles.discountPill}>{tUi('ui.mobile.adminProducts.sale')}</Text> : null}
                  </View>
                }
              />
            );
          })}
          {!products.length ? (
            <Text style={styles.emptyText}>{tUi('ui.pages.admin.adminProducts.noProductsFound_3cff798862')}</Text>
          ) : null}
        </View>
      )}

      {selectedProduct && selectedSentiment ? (
        <View style={styles.detailCard}>
          <View style={[styles.detailHeader, { flexDirection: row }]}>
            <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
            <Text style={styles.detailMeta}>#{selectedProduct.id}</Text>
          </View>
          <View style={[styles.imageStrip, { flexDirection: row }]}>
            {normalizeProductImages(selectedProduct).map((image, index) => (
              <Image key={`${image}-${index}`} source={{ uri: buildImageUrl(image) }} style={styles.detailImage} />
            ))}
          </View>
          <View style={[styles.detailGrid, { flexDirection: row }]}>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminProducts.price_e83d5427d6')}</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedProduct.price || 0)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>{tUi('ui.mobile.adminProducts.labelFinal')}</Text>
              <Text style={styles.detailValue}>{formatCurrency(calculateDiscountedPrice(selectedProduct))}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminProducts.stock_04fad4218b')}</Text>
              <Text style={styles.detailValue}>{selectedProduct.quantity || 0}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminProducts.reviewSentiment_ab05791b1b')}</Text>
              <Text style={styles.detailValue}>
                {selectedSentiment.positiveRate}% {tUi('ui.mobile.adminProducts.labelPositive')} ·{' '}
                {tUi('ui.mobile.adminProducts.ratingsSummary', { value0: selectedSentiment.total_reviews || 0 })}
              </Text>
            </View>
          </View>
          <View style={[styles.actionRow, { flexDirection: row }]}>
            <Pressable style={styles.secondaryButton} onPress={() => openEdit(selectedProduct)}>
              <Text style={styles.secondaryButtonText}>{tUi('ui.pages.admin.adminProducts.edit_6b4f086241')}</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(selectedProduct)}>
              <Text style={styles.deleteButtonText}>{tUi('ui.pages.admin.adminProducts.delete_d93e34aa58')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={resetForm}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingProduct
                  ? tUi('ui.pages.admin.adminProducts.editProduct_e63de796e6')
                  : tUi('ui.pages.admin.adminProducts.addNewProduct_109f983c59')}
              </Text>

              <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.productName_f2fbd60c6e')}</Text>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                value={form.name}
                onChangeText={(value) => updateForm('name', value)}
              />

              <View style={[styles.formRow, { flexDirection: row }]}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.nameArabic')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.name_ar}
                    onChangeText={(value) => updateForm('name_ar', value)}
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.nameFrench')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.name_fr}
                    onChangeText={(value) => updateForm('name_fr', value)}
                  />
                </View>
              </View>

              <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.description_92d5f9f27a')}</Text>
              <TextInput
                style={[styles.input, styles.textArea, inputRtlStyle]}
                value={form.description}
                onChangeText={(value) => updateForm('description', value)}
                multiline
              />

              <View style={[styles.formRow, { flexDirection: row }]}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.descriptionArabic')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, inputRtlStyle]}
                    value={form.description_ar}
                    onChangeText={(value) => updateForm('description_ar', value)}
                    multiline
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.descriptionFrench')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, inputRtlStyle]}
                    value={form.description_fr}
                    onChangeText={(value) => updateForm('description_fr', value)}
                    multiline
                  />
                </View>
              </View>

              <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.categoryName_d2ea6c7aa6')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id || category.name}
                    style={[
                      styles.categoryChip,
                      form.category_name === category.name && styles.categoryChipActive,
                    ]}
                    onPress={() => updateForm('category_name', category.name)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        form.category_name === category.name && styles.categoryTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.formRow, { flexDirection: row }]}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.price_e83d5427d6')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.price}
                    onChangeText={(value) => updateForm('price', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.quantity_05a793b136')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.quantity}
                    onChangeText={(value) => updateForm('quantity', value)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={[styles.discountHeader, { flexDirection: row }]}>
                <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.enableDiscount_6f1ae41f4b')}</Text>
                <Pressable
                  style={[styles.toggleButton, form.discount_enabled && styles.toggleButtonActive]}
                  onPress={() => updateForm('discount_enabled', !form.discount_enabled)}
                >
                  <Text style={[styles.toggleText, form.discount_enabled && styles.toggleTextActive]}>
                    {form.discount_enabled ? tUi('ui.mobile.adminProducts.on') : tUi('ui.mobile.adminProducts.off')}
                  </Text>
                </Pressable>
              </View>

              {form.discount_enabled ? (
                <View style={[styles.formRow, { flexDirection: row }]}>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.discountType_290629062f')}</Text>
                    <View style={[styles.segmentRow, { flexDirection: row }]}>
                      {['percentage', 'fixed'].map((type) => (
                        <Pressable
                          key={type}
                          style={[styles.segment, form.discount_type === type && styles.segmentActive]}
                          onPress={() => updateForm('discount_type', type)}
                        >
                          <Text style={[styles.segmentText, form.discount_type === type && styles.segmentTextActive]}>
                            {type === 'percentage'
                              ? tUi('ui.pages.admin.adminProducts.percentage_a8cb8ffe45')
                              : tUi('ui.pages.admin.adminProducts.fixedAmount_3189e1492d')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>{tUi('ui.pages.admin.adminProducts.discountValue_e3feb63e4a')}</Text>
                    <TextInput
                      style={[styles.input, inputRtlStyle]}
                      value={form.discount_value}
                      onChangeText={(value) => updateForm('discount_value', value)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : null}

              <View style={[styles.imagesHeader, { flexDirection: row }]}>
                <View style={styles.imagesHeaderText}>
                  <Text style={styles.label}>
                    {tUi('ui.pages.admin.adminProducts.productImages13Images_b802fc6b5e')}
                  </Text>
                  <Text style={styles.imagesCountText}>
                    {tUi('ui.pages.admin.adminProducts.value3ImagesSelected_586058179b', { value0: images.length })}
                  </Text>
                </View>
                <Pressable style={[styles.pickButton, { flexDirection: row }]} onPress={handlePickImages} disabled={uploading}>
                  <Feather name="image" size={14} color={colors.primary} />
                  <Text style={styles.pickButtonText}>
                    {uploading ? tUi('ui.mobile.adminProducts.uploading') : tUi('ui.mobile.adminProducts.addImage')}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.previewRow, { flexDirection: row }]}>
                {images.map((image, index) => (
                  <View key={`${image}-${index}`} style={styles.previewWrap}>
                    <Image source={{ uri: buildImageUrl(image) }} style={styles.previewImage} />
                    <Pressable style={styles.removeImageButton} onPress={() => handleRemoveImage(index)}>
                      <Feather name="x" size={14} color={colors.surface} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={[styles.formActions, { flexDirection: row }]}>
                <Pressable style={styles.secondaryButton} onPress={resetForm}>
                  <Text style={styles.secondaryButtonText}>{tUi('ui.mobile.common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.primaryActionButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.primaryActionText}>
                    {saving ? tUi('ui.mobile.common.saving') : tUi('ui.mobile.common.save')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: colors.surface,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  productRight: {
    alignItems: 'flex-end',
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  discountPill: {
    marginTop: 6,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    ...shadow,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
    flex: 1,
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  imageStrip: {
    flexDirection: 'row',
    marginTop: 12,
  },
  detailImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: colors.surfaceAlt,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  detailCell: {
    width: '50%',
    marginBottom: 12,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 20,
    marginBottom: 14,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formColumn: {
    flex: 1,
  },
  categoryScroller: {
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: colors.surface,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: colors.surface,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.surface,
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  imagesHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  imagesCountText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 14,
  },
  previewWrap: {
    width: 76,
    height: 76,
    marginRight: 8,
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default AdminProductsScreen;

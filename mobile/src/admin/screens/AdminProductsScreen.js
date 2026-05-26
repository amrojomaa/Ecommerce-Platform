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
import { colors, shadow } from '../styles/theme';
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
    const analytics = {};
    await Promise.all(
      productsToAnalyze.map(async (product) => {
        try {
          const response = await http.get(
            buildUrl(COMMENT_ENDPOINTS.SENTIMENT_ANALYTICS, { product_id: product.id })
          );
          analytics[product.id] = response.data || DEFAULT_ANALYTICS;
        } catch (_) {
          analytics[product.id] = DEFAULT_ANALYTICS;
        }
      })
    );
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
      Toast.show({ type: 'error', text1: 'Maximum 3 images allowed' });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Photo permission is required' });
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
      Toast.show({ type: 'error', text1: 'Maximum 3 images allowed' });
      return;
    }

    setUploading(true);
    try {
      const uploadedImages = await Promise.all(assets.map(uploadPickedImage));
      setImages((prev) => [...prev, ...uploadedImages]);
      Toast.show({ type: 'success', text1: 'Images uploaded' });
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to upload images' });
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
      Toast.show({ type: 'error', text1: 'Name, description, and category are required' });
      return false;
    }
    if (Number.isNaN(price) || price <= 0) {
      Toast.show({ type: 'error', text1: 'Price must be greater than zero' });
      return false;
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      Toast.show({ type: 'error', text1: 'Quantity must be zero or greater' });
      return false;
    }
    if (images.length < 1 || images.length > 3) {
      Toast.show({ type: 'error', text1: 'Add 1 to 3 product images' });
      return false;
    }
    if (form.discount_enabled) {
      if (!['percentage', 'fixed'].includes(form.discount_type)) {
        Toast.show({ type: 'error', text1: 'Select a valid discount type' });
        return false;
      }
      if (Number.isNaN(discountValue) || discountValue <= 0) {
        Toast.show({ type: 'error', text1: 'Discount value must be greater than zero' });
        return false;
      }
      if (form.discount_type === 'percentage' && discountValue > 100) {
        Toast.show({ type: 'error', text1: 'Percentage discount cannot exceed 100' });
        return false;
      }
      if (form.discount_type === 'fixed' && discountValue > price) {
        Toast.show({ type: 'error', text1: 'Fixed discount cannot exceed price' });
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
        Toast.show({ type: 'success', text1: 'Product updated' });
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, payload);
        Toast.show({ type: 'success', text1: 'Product created' });
      }
      resetForm();
      await fetchProducts();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to save product' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    const ok = await confirmAction('Delete product', `Delete ${product.name}?`);
    if (!ok) return;
    try {
      await http.delete(buildUrl(PRODUCT_ENDPOINTS.DELETE, { id: product.id }));
      Toast.show({ type: 'success', text1: 'Product deleted' });
      setExpandedProductId(null);
      await fetchProducts();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to delete product' });
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
    return { ...analytics, positiveRate };
  };

  return (
    <AdminScreen
      title="Products"
      subtitle="Manage product catalog, stock, images, and discounts."
      action={
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Feather name="plus" size={16} color={colors.surface} />
          <Text style={styles.primaryButtonText}>Add Product</Text>
        </Pressable>
      }
    >
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, filters.lowStock && styles.filterChipActive]}
          onPress={() => setFilters((prev) => ({ ...prev, lowStock: !prev.lowStock }))}
        >
          <Text style={[styles.filterText, filters.lowStock && styles.filterTextActive]}>
            Low stock
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filters.discounted && styles.filterChipActive]}
          onPress={() => setFilters((prev) => ({ ...prev, discounted: !prev.discounted }))}
        >
          <Text style={[styles.filterText, filters.discounted && styles.filterTextActive]}>
            Discounted
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
            const stockLabel = Number(product.quantity || 0) < lowStockThreshold ? 'Low stock' : 'In stock';
            const statusTone = Number(product.quantity || 0) < lowStockThreshold ? 'warning' : 'success';
            const imagePath = getFirstImage(product);
            return (
              <AdminListItem
                key={product.id}
                title={product.name}
                subtitle={product.description}
                meta={`${formatCurrency(calculateDiscountedPrice(product))} | ${product.category_name || 'Uncategorized'} | ${product.quantity || 0} units`}
                status={stockLabel}
                statusTone={statusTone}
                onPress={() => setExpandedProductId((prev) => (prev === product.id ? null : product.id))}
                right={
                  <View style={styles.productRight}>
                    {imagePath ? <Image source={{ uri: buildImageUrl(imagePath) }} style={styles.thumbnail} /> : null}
                    {product.discount_enabled ? <Text style={styles.discountPill}>Sale</Text> : null}
                  </View>
                }
              />
            );
          })}
          {!products.length ? <Text style={styles.emptyText}>No products match your filters.</Text> : null}
        </View>
      )}

      {selectedProduct ? (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
            <Text style={styles.detailMeta}>#{selectedProduct.id}</Text>
          </View>
          <View style={styles.imageStrip}>
            {normalizeProductImages(selectedProduct).map((image, index) => (
              <Image key={`${image}-${index}`} source={{ uri: buildImageUrl(image) }} style={styles.detailImage} />
            ))}
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedProduct.price || 0)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Final</Text>
              <Text style={styles.detailValue}>{formatCurrency(calculateDiscountedPrice(selectedProduct))}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Stock</Text>
              <Text style={styles.detailValue}>{selectedProduct.quantity || 0}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Positive</Text>
              <Text style={styles.detailValue}>{getSentimentSummary(selectedProduct.id).positiveRate}%</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={() => openEdit(selectedProduct)}>
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(selectedProduct)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={resetForm}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(value) => updateForm('name', value)} />

              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Arabic name</Text>
                  <TextInput style={styles.input} value={form.name_ar} onChangeText={(value) => updateForm('name_ar', value)} />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>French name</Text>
                  <TextInput style={styles.input} value={form.name_fr} onChangeText={(value) => updateForm('name_fr', value)} />
                </View>
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(value) => updateForm('description', value)}
                multiline
              />

              <Text style={styles.label}>Category</Text>
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

              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={(value) => updateForm('price', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={form.quantity}
                    onChangeText={(value) => updateForm('quantity', value)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.discountHeader}>
                <Text style={styles.label}>Discount</Text>
                <Pressable
                  style={[styles.toggleButton, form.discount_enabled && styles.toggleButtonActive]}
                  onPress={() => updateForm('discount_enabled', !form.discount_enabled)}
                >
                  <Text style={[styles.toggleText, form.discount_enabled && styles.toggleTextActive]}>
                    {form.discount_enabled ? 'On' : 'Off'}
                  </Text>
                </Pressable>
              </View>

              {form.discount_enabled ? (
                <View style={styles.formRow}>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>Type</Text>
                    <View style={styles.segmentRow}>
                      {['percentage', 'fixed'].map((type) => (
                        <Pressable
                          key={type}
                          style={[styles.segment, form.discount_type === type && styles.segmentActive]}
                          onPress={() => updateForm('discount_type', type)}
                        >
                          <Text style={[styles.segmentText, form.discount_type === type && styles.segmentTextActive]}>
                            {type === 'percentage' ? '%' : '$'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>Value</Text>
                    <TextInput
                      style={styles.input}
                      value={form.discount_value}
                      onChangeText={(value) => updateForm('discount_value', value)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.imagesHeader}>
                <Text style={styles.label}>Images ({images.length}/3)</Text>
                <Pressable style={styles.pickButton} onPress={handlePickImages} disabled={uploading}>
                  <Feather name="image" size={14} color={colors.primary} />
                  <Text style={styles.pickButtonText}>{uploading ? 'Uploading...' : 'Add'}</Text>
                </Pressable>
              </View>
              <View style={styles.previewRow}>
                {images.map((image, index) => (
                  <View key={`${image}-${index}`} style={styles.previewWrap}>
                    <Image source={{ uri: buildImageUrl(image) }} style={styles.previewImage} />
                    <Pressable style={styles.removeImageButton} onPress={() => handleRemoveImage(index)}>
                      <Feather name="x" size={14} color={colors.surface} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.formActions}>
                <Pressable style={styles.secondaryButton} onPress={resetForm}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryActionButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.primaryActionText}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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

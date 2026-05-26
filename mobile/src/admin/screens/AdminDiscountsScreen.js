import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { colors } from '../styles/theme';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, buildUrl } from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';

const AdminDiscountsScreen = () => {
  const { formatCurrency } = useCurrency();
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ discount_enabled: false, discount_type: 'percentage', discount_value: '' });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const list = response.data || [];
      setAllProducts(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const discountedProducts = allProducts.filter((p) => p.discount_enabled);
    const filtered = searchQuery
      ? discountedProducts.filter((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : discountedProducts;
    setProducts(filtered);
  }, [allProducts, searchQuery]);

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      discount_enabled: product.discount_enabled || false,
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      await http.patch(buildUrl(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT, { id: editingProduct.id }), {
        discount_enabled: Boolean(form.discount_enabled),
        discount_type: form.discount_enabled ? form.discount_type : null,
        discount_value: form.discount_enabled ? Number.parseFloat(form.discount_value || 0) : 0,
      });
      setShowModal(false);
      setEditingProduct(null);
      fetchProducts();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (product) => {
    setSaving(true);
    try {
      await http.patch(buildUrl(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT, { id: product.id }), {
        discount_enabled: !product.discount_enabled,
        discount_type: product.discount_type || 'percentage',
        discount_value: Number.parseFloat(product.discount_value || 0),
      });
      fetchProducts();
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === expandedProductId) || null,
    [expandedProductId, products]
  );

  const totalDiscountValue = useMemo(
    () => allProducts
      .filter((p) => p.discount_enabled)
      .reduce((sum, p) => sum + ((parseFloat(p.discount_value) || 0) * (p.quantity_in_stock || 0)), 0),
    [allProducts]
  );

  return (
    <AdminScreen
      title="Discounts"
      subtitle="Review and manage active product discounts."
      meta={`${allProducts.filter((p) => p.discount_enabled).length} products`}
    >
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or SKU..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Discount Value</Text>
        <Text style={styles.summaryValue}>{formatCurrency(totalDiscountValue)}</Text>
        <Text style={styles.summaryMeta}>{products.length} active discounts</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {products.map((product) => (
            <AdminListItem
              key={product.id}
              title={product.name}
              subtitle={product.sku}
              meta={`${product.discount_type === 'percentage' ? '%' : '$'}${product.discount_value}`}
              status={product.discount_enabled ? 'Active' : 'Inactive'}
              statusTone={product.discount_enabled ? 'success' : 'default'}
              onPress={() =>
                setExpandedProductId((prev) => (prev === product.id ? null : product.id))
              }
              right={
                <Pressable onPress={() => openEdit(product)}>
                  <Text style={styles.inlineButton}>Edit</Text>
                </Pressable>
              }
            />
          ))}
          {!products.length ? (
            <Text style={styles.emptyText}>
              {allProducts.filter((p) => p.discount_enabled).length === 0
                ? 'No active discounts.'
                : 'No matching discounts.'}
            </Text>
          ) : null}
        </View>
      )}

      {selectedProduct ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
          <Text style={styles.detailMeta}>SKU: {selectedProduct.sku}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>{formatCurrency(selectedProduct.price || 0)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Discount Type</Text>
            <Text style={styles.detailValue}>{selectedProduct.discount_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Discount Value</Text>
            <Text style={styles.detailValue}>{selectedProduct.discount_value}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock</Text>
            <Text style={styles.detailValue}>{selectedProduct.quantity_in_stock || 0}</Text>
          </View>
          {selectedProduct.discount_description ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{selectedProduct.discount_description}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Discount</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Discount Enabled</Text>
              <Pressable
                style={[styles.toggleButton, form.discount_enabled && styles.toggleButtonActive]}
                onPress={() => setForm((prev) => ({ ...prev, discount_enabled: !prev.discount_enabled }))}
              >
                <Text style={[styles.toggleText, form.discount_enabled && styles.toggleTextActive]}>
                  {form.discount_enabled ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
            {form.discount_enabled ? (
              <>
                <View style={styles.formRow}>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>Type</Text>
                    <Text style={styles.select}>{form.discount_type}</Text>
                  </View>
                  <View style={styles.formColumn}>
                    <Text style={styles.label}>Value</Text>
                    <TextInput
                      style={styles.input}
                      value={form.discount_value}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, discount_value: value }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                </View>
              </>
            ) : null}
            <View style={styles.formActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  searchBox: {
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  summaryMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  inlineButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  detailMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  detailRow: {
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 4,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 12,
    color: colors.text,
  },
  toggleTextActive: {
    color: colors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  select: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formColumn: {
    flex: 1,
    marginRight: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});

export default AdminDiscountsScreen;

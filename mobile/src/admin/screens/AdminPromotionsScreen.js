import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { colors, shadow } from '../styles/theme';
import http from '../../services/http';
import { PROMOTION_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';

const filterLabels = {
  include_products: 'Include products',
  exclude_products: 'Exclude products',
  include_categories: 'Include categories',
  exclude_categories: 'Exclude categories',
};

const emptyForm = {
  name: '',
  is_active: false,
  target_type: 'amount',
  target_value: '',
  discount_type: 'percentage',
  discount_value: '',
  filter_type: 'include_products',
  filter_values: [],
};

const AdminPromotionsScreen = () => {
  const [promotions, setPromotions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [optionSearch, setOptionSearch] = useState('');

  const getAuthConfig = async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('Session missing. Please sign in again.');
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [promoRes, productsRes, categoriesRes] = await Promise.all([
        http.get(PROMOTION_ENDPOINTS.LIST),
        http.get(PROMOTION_ENDPOINTS.PRODUCT_OPTIONS),
        http.get(PROMOTION_ENDPOINTS.CATEGORY_OPTIONS),
      ]);
      setPromotions(Array.isArray(promoRes.data) ? promoRes.data : []);
      setProductOptions(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCategoryOptions(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingPromotion(null);
    setForm(emptyForm);
    setOptionSearch('');
    setShowModal(false);
  };

  const openCreate = () => {
    setEditingPromotion(null);
    setForm(emptyForm);
    setOptionSearch('');
    setShowModal(true);
  };

  const openEdit = (promo) => {
    setEditingPromotion(promo);
    setForm({
      name: promo.name || '',
      is_active: Boolean(promo.is_active),
      target_type: promo.target_type || 'amount',
      target_value: String(promo.target_value ?? ''),
      discount_type: promo.discount_type || 'percentage',
      discount_value: String(promo.discount_value ?? ''),
      filter_type: promo.filter_type || 'include_products',
      filter_values: Array.isArray(promo.filter_values) ? promo.filter_values : [],
    });
    setOptionSearch('');
    setShowModal(true);
  };

  const setFormField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'filter_type') {
        next.filter_values = [];
      }
      return next;
    });
  };

  const activeOptions = useMemo(() => {
    const isProductFilter = form.filter_type.includes('products');
    const rawOptions = isProductFilter ? productOptions : categoryOptions;
    const query = optionSearch.trim().toLowerCase();
    const visible = query
      ? rawOptions.filter((item) => item.toLowerCase().includes(query))
      : rawOptions;
    return visible.filter((item) => !form.filter_values.includes(item));
  }, [categoryOptions, form.filter_type, form.filter_values, optionSearch, productOptions]);

  const addFilterValue = (value) => {
    setForm((prev) => {
      if (prev.filter_values.includes(value)) return prev;
      return { ...prev, filter_values: [...prev.filter_values, value] };
    });
  };

  const removeFilterValue = (value) => {
    setForm((prev) => ({
      ...prev,
      filter_values: prev.filter_values.filter((entry) => entry !== value),
    }));
  };

  const validateForm = () => {
    const targetValue = Number.parseFloat(form.target_value);
    const discountValue = Number.parseFloat(form.discount_value);

    if (!form.name.trim()) return 'Promotion name is required';
    if (Number.isNaN(targetValue) || targetValue <= 0) {
      return 'Target value must be greater than zero';
    }
    if (Number.isNaN(discountValue) || discountValue <= 0) {
      return 'Discount value must be greater than zero';
    }
    if (form.discount_type === 'percentage' && discountValue > 100) {
      return 'Percentage discount cannot exceed 100';
    }
    if (!form.filter_values.length) {
      return 'Select at least one product or category';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Toast.show({ type: 'error', text1: validationError });
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      target_value: Number.parseFloat(form.target_value),
      discount_value: Number.parseFloat(form.discount_value),
    };

    setSaving(true);
    try {
      const authConfig = await getAuthConfig();
      if (editingPromotion) {
        await http.put(
          buildUrl(PROMOTION_ENDPOINTS.UPDATE, { promotion_id: editingPromotion.id }),
          payload,
          authConfig
        );
        Toast.show({ type: 'success', text1: 'Promotion updated' });
      } else {
        await http.post(PROMOTION_ENDPOINTS.CREATE, payload, authConfig);
        Toast.show({ type: 'success', text1: 'Promotion created' });
      }
      resetForm();
      await loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to save promotion' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo) => {
    const ok = await confirmAction('Delete promotion', `Delete ${promo.name}?`);
    if (!ok) return;
    try {
      const authConfig = await getAuthConfig();
      await http.delete(buildUrl(PROMOTION_ENDPOINTS.DELETE, { promotion_id: promo.id }), authConfig);
      Toast.show({ type: 'success', text1: 'Promotion deleted' });
      await loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to delete promotion' });
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      const authConfig = await getAuthConfig();
      await http.patch(buildUrl(PROMOTION_ENDPOINTS.SET_ACTIVE, { promotion_id: promo.id }), {
        is_active: !promo.is_active,
      }, authConfig);
      await loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to update promotion' });
    }
  };

  const describePromotion = (promo) => {
    const target = promo.target_type === 'amount' ? `Spend ${promo.target_value}` : `Buy ${promo.target_value}`;
    const discount = promo.discount_type === 'percentage'
      ? `${promo.discount_value}% off`
      : `$${promo.discount_value} off`;
    return `${target} | ${discount} | ${filterLabels[promo.filter_type] || promo.filter_type}`;
  };

  return (
    <AdminScreen
      title="Promotions"
      subtitle="Build rule-based cart promotions for selected products or categories."
      action={
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Text style={styles.primaryButtonText}>New</Text>
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {promotions.map((promo) => (
            <View key={promo.id} style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <View style={styles.promoTitleWrap}>
                  <Text style={styles.promoTitle}>{promo.name}</Text>
                  <Text style={styles.promoMeta}>{describePromotion(promo)}</Text>
                </View>
                <Text style={[styles.promoBadge, promo.is_active && styles.promoBadgeActive]}>
                  {promo.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.valueWrap}>
                {(promo.filter_values || []).map((value) => (
                  <Text key={value} style={styles.valuePill}>{value}</Text>
                ))}
              </View>
              <View style={styles.promoActions}>
                <Pressable onPress={() => openEdit(promo)}>
                  <Text style={styles.actionButton}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleToggleActive(promo)}>
                  <Text style={styles.actionButton}>{promo.is_active ? 'Disable' : 'Enable'}</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(promo)}>
                  <Text style={[styles.actionButton, styles.deleteButtonText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!promotions.length ? <Text style={styles.emptyText}>No promotions yet.</Text> : null}
        </View>
      )}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={resetForm}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingPromotion ? 'Edit promotion' : 'New promotion'}</Text>

              <Text style={styles.label}>Promotion name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(value) => setFormField('name', value)}
                placeholder="Weekend fruits deal"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.label}>Target type</Text>
              <View style={styles.segmentRow}>
                {['amount', 'quantity'].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.segment, form.target_type === type && styles.segmentActive]}
                    onPress={() => setFormField('target_type', type)}
                  >
                    <Text style={[styles.segmentText, form.target_type === type && styles.segmentTextActive]}>
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Target value</Text>
                  <TextInput
                    style={styles.input}
                    value={form.target_value}
                    onChangeText={(value) => setFormField('target_value', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Discount value</Text>
                  <TextInput
                    style={styles.input}
                    value={form.discount_value}
                    onChangeText={(value) => setFormField('discount_value', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>Discount type</Text>
              <View style={styles.segmentRow}>
                {['percentage', 'fixed'].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.segment, form.discount_type === type && styles.segmentActive]}
                    onPress={() => setFormField('discount_type', type)}
                  >
                    <Text style={[styles.segmentText, form.discount_type === type && styles.segmentTextActive]}>
                      {type === 'percentage' ? 'Percentage' : 'Fixed'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Rule</Text>
              <View style={styles.ruleGrid}>
                {Object.entries(filterLabels).map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.ruleChip, form.filter_type === key && styles.ruleChipActive]}
                    onPress={() => setFormField('filter_type', key)}
                  >
                    <Text style={[styles.ruleText, form.filter_type === key && styles.ruleTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Selected</Text>
              <View style={styles.valueWrap}>
                {form.filter_values.map((value) => (
                  <Pressable key={value} style={styles.selectedPill} onPress={() => removeFilterValue(value)}>
                    <Text style={styles.selectedPillText}>{value} x</Text>
                  </Pressable>
                ))}
                {!form.filter_values.length ? <Text style={styles.emptyInline}>None selected</Text> : null}
              </View>

              <Text style={styles.label}>Add products/categories</Text>
              <TextInput
                style={styles.input}
                value={optionSearch}
                onChangeText={setOptionSearch}
                placeholder="Search options"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.optionBox}>
                {activeOptions.slice(0, 30).map((option) => (
                  <Pressable key={option} style={styles.optionRow} onPress={() => addFilterValue(option)}>
                    <Text style={styles.optionText}>{option}</Text>
                    <Text style={styles.optionAdd}>Add</Text>
                  </Pressable>
                ))}
                {!activeOptions.length ? <Text style={styles.emptyInline}>No options available</Text> : null}
              </View>

              <View style={styles.activeRow}>
                <Text style={styles.label}>Active</Text>
                <Pressable
                  style={[styles.toggleButton, form.is_active && styles.toggleButtonActive]}
                  onPress={() => setFormField('is_active', !form.is_active)}
                >
                  <Text style={[styles.toggleText, form.is_active && styles.toggleTextActive]}>
                    {form.is_active ? 'On' : 'Off'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formActions}>
                <Pressable style={styles.secondaryButton} onPress={resetForm}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryActionButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 12,
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  promoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadow,
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promoTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  promoBadge: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promoBadgeActive: {
    borderColor: colors.success,
    color: colors.success,
  },
  promoMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
  valueWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  valuePill: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  promoActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  actionButton: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteButtonText: {
    color: colors.danger,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formColumn: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
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
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: colors.surface,
  },
  ruleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  ruleChip: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.surfaceAlt,
  },
  ruleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ruleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  ruleTextActive: {
    color: colors.surface,
  },
  selectedPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedPillText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  optionBox: {
    maxHeight: 190,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  optionAdd: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  formActions: {
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
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default AdminPromotionsScreen;

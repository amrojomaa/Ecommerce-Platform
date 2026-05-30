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
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { PROMOTION_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';

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

const FILTER_TYPES = [
  'include_products',
  'exclude_products',
  'include_categories',
  'exclude_categories',
];

const AdminPromotionsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl } = useLanguage();
  const { textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [promotions, setPromotions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [optionSearch, setOptionSearch] = useState('');

  const filterLabels = useMemo(
    () => ({
      include_products: tUi('ui.mobile.adminPromotions.filterIncludeProducts'),
      exclude_products: tUi('ui.mobile.adminPromotions.filterExcludeProducts'),
      include_categories: tUi('ui.mobile.adminPromotions.filterIncludeCategories'),
      exclude_categories: tUi('ui.mobile.adminPromotions.filterExcludeCategories'),
    }),
    [tUi]
  );

  const getFilterLabel = (filterType) => filterLabels[filterType] || filterType;

  const getAuthConfig = async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error(tUi('ui.toast.operationFailed'));
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

    if (!form.name.trim()) return tUi('ui.mobile.adminPromotions.validationName');
    if (Number.isNaN(targetValue) || targetValue <= 0) {
      return tUi('ui.mobile.adminPromotions.validationTarget');
    }
    if (Number.isNaN(discountValue) || discountValue <= 0) {
      return tUi('ui.mobile.adminPromotions.validationDiscount');
    }
    if (form.discount_type === 'percentage' && discountValue > 100) {
      return tUi('ui.mobile.adminPromotions.validationPercent');
    }
    if (!form.filter_values.length) {
      return tUi('ui.mobile.adminPromotions.validationFilter');
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
        Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminPromotions.promotionUpdated_3f8ee4a136') });
      } else {
        await http.post(PROMOTION_ENDPOINTS.CREATE, payload, authConfig);
        Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminPromotions.promotionCreated_6ec4515cf9') });
      }
      resetForm();
      await loadData();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminPromotions.failedSave'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminPromotions.deletePromotion_038b26221a'),
      tUi('ui.mobile.adminPromotions.deleteConfirm', { value0: promo.name }),
      tUi('ui.mobile.common.confirm'),
      tUi('ui.mobile.common.cancel')
    );
    if (!ok) return;
    try {
      const authConfig = await getAuthConfig();
      await http.delete(buildUrl(PROMOTION_ENDPOINTS.DELETE, { promotion_id: promo.id }), authConfig);
      Toast.show({ type: 'success', text1: tUi('ui.pages.admin.adminPromotions.promotionDeleted_b08f0c57d3') });
      await loadData();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminPromotions.failedDelete'),
      });
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
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminPromotions.failedUpdate'),
      });
    }
  };

  const describePromotion = (promo) => {
    const target = promo.target_type === 'amount'
      ? tUi('ui.mobile.adminPromotions.spendTarget', { value0: promo.target_value })
      : tUi('ui.mobile.adminPromotions.buyTarget', { value0: promo.target_value });
    const discount = promo.discount_type === 'percentage'
      ? tUi('ui.mobile.adminPromotions.percentOff', { value0: promo.discount_value })
      : tUi('ui.mobile.adminPromotions.amountOff', { value0: `$${promo.discount_value}` });
    return `${target} | ${discount} | ${getFilterLabel(promo.filter_type)}`;
  };

  return (
    <AdminScreen
      title={tUi('ui.pages.admin.adminPromotions.promotions_8cc39c7561')}
      subtitle={tUi('ui.pages.admin.adminPromotions.createRuleBasedDiscountsFor_4ea978f98e')}
      action={
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Text style={styles.primaryButtonText}>
            {tUi('ui.pages.admin.adminPromotions.createPromotion_f093f3973d')}
          </Text>
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
              <View style={[styles.promoHeader, { flexDirection: row }]}>
                <View style={[styles.promoTitleWrap, isRtl ? styles.promoTitleWrapRtl : null]}>
                  <Text style={styles.promoTitle}>{promo.name}</Text>
                  <Text style={styles.promoMeta}>{describePromotion(promo)}</Text>
                </View>
                <Text style={[styles.promoBadge, promo.is_active && styles.promoBadgeActive]}>
                  {promo.is_active
                    ? tUi('ui.mobile.common.active')
                    : tUi('ui.mobile.common.inactive')}
                </Text>
              </View>
              <View style={[styles.valueWrap, { flexDirection: row }]}>
                {(promo.filter_values || []).map((value) => (
                  <Text key={value} style={styles.valuePill}>{value}</Text>
                ))}
              </View>
              <View style={[styles.promoActions, { flexDirection: row }]}>
                <Pressable onPress={() => openEdit(promo)}>
                  <Text style={styles.actionButton}>
                    {tUi('ui.pages.admin.adminPromotions.edit_0a20314f38')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleToggleActive(promo)}>
                  <Text style={styles.actionButton}>
                    {promo.is_active
                      ? tUi('ui.mobile.adminPromotions.disable')
                      : tUi('ui.mobile.adminPromotions.enable')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(promo)}>
                  <Text style={[styles.actionButton, styles.deleteButtonText]}>
                    {tUi('ui.pages.admin.adminPromotions.delete_54b841e5c7')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!promotions.length ? (
            <Text style={styles.emptyText}>
              {tUi('ui.pages.admin.adminPromotions.noPromotionsYet_258a69c574')}
            </Text>
          ) : null}
        </View>
      )}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={resetForm}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingPromotion
                  ? tUi('ui.pages.admin.adminPromotions.editPromotion_c2740c715e')
                  : tUi('ui.mobile.adminPromotions.newPromotion')}
              </Text>

              <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.promotionName_df0623c346')}</Text>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                value={form.name}
                onChangeText={(value) => setFormField('name', value)}
                placeholder={tUi('ui.pages.admin.adminPromotions.exampleWeekendFruitsDeal_29e2c6c9a5')}
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.targetType_fefe0c8c35')}</Text>
              <View style={[styles.segmentRow, { flexDirection: row }]}>
                {['amount', 'quantity'].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.segment, form.target_type === type && styles.segmentActive]}
                    onPress={() => setFormField('target_type', type)}
                  >
                    <Text style={[styles.segmentText, form.target_type === type && styles.segmentTextActive]}>
                      {type === 'amount'
                        ? tUi('ui.pages.admin.adminPromotions.amount_3a1fe500a9')
                        : tUi('ui.pages.admin.adminPromotions.quantity_d07d26e488')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.formRow, { flexDirection: row }]}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.targetValue_75b09d40c0')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.target_value}
                    onChangeText={(value) => setFormField('target_value', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.discountValue_e889384e6c')}</Text>
                  <TextInput
                    style={[styles.input, inputRtlStyle]}
                    value={form.discount_value}
                    onChangeText={(value) => setFormField('discount_value', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.discountType_01c9cdd79c')}</Text>
              <View style={[styles.segmentRow, { flexDirection: row }]}>
                {['percentage', 'fixed'].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.segment, form.discount_type === type && styles.segmentActive]}
                    onPress={() => setFormField('discount_type', type)}
                  >
                    <Text style={[styles.segmentText, form.discount_type === type && styles.segmentTextActive]}>
                      {type === 'percentage'
                        ? tUi('ui.pages.admin.adminPromotions.percentage_5c6ebe68e7')
                        : tUi('ui.mobile.adminPromotions.fixed')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{tUi('ui.mobile.adminPromotions.rule')}</Text>
              <View style={[styles.ruleGrid, { flexDirection: row }]}>
                {FILTER_TYPES.map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.ruleChip, form.filter_type === key && styles.ruleChipActive]}
                    onPress={() => setFormField('filter_type', key)}
                  >
                    <Text style={[styles.ruleText, form.filter_type === key && styles.ruleTextActive]}>
                      {filterLabels[key]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{tUi('ui.mobile.adminPromotions.selected')}</Text>
              <View style={[styles.valueWrap, { flexDirection: row }]}>
                {form.filter_values.map((value) => (
                  <Pressable key={value} style={styles.selectedPill} onPress={() => removeFilterValue(value)}>
                    <Text style={styles.selectedPillText}>{value} x</Text>
                  </Pressable>
                ))}
                {!form.filter_values.length ? (
                  <Text style={styles.emptyInline}>{tUi('ui.mobile.adminPromotions.noneSelected')}</Text>
                ) : null}
              </View>

              <Text style={styles.label}>{tUi('ui.mobile.adminPromotions.addOptions')}</Text>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                value={optionSearch}
                onChangeText={setOptionSearch}
                placeholder={tUi('ui.pages.admin.adminPromotions.search_3ef2a27f22')}
                placeholderTextColor={colors.muted}
              />
              <View style={styles.optionBox}>
                {activeOptions.slice(0, 30).map((option) => (
                  <Pressable key={option} style={[styles.optionRow, { flexDirection: row }]} onPress={() => addFilterValue(option)}>
                    <Text style={styles.optionText}>{option}</Text>
                    <Text style={styles.optionAdd}>{tUi('ui.pages.admin.adminPromotions.select_f53d6e97bb')}</Text>
                  </Pressable>
                ))}
                {!activeOptions.length ? (
                  <Text style={styles.emptyInline}>{tUi('ui.mobile.adminPromotions.noOptions')}</Text>
                ) : null}
              </View>

              <View style={[styles.activeRow, { flexDirection: row }]}>
                <Text style={styles.label}>{tUi('ui.pages.admin.adminPromotions.active_9a948ffb7d')}</Text>
                <Pressable
                  style={[styles.toggleButton, form.is_active && styles.toggleButtonActive]}
                  onPress={() => setFormField('is_active', !form.is_active)}
                >
                  <Text style={[styles.toggleText, form.is_active && styles.toggleTextActive]}>
                    {form.is_active
                      ? tUi('ui.mobile.adminPromotions.on')
                      : tUi('ui.mobile.adminPromotions.off')}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.formActions, { flexDirection: row }]}>
                <Pressable style={styles.secondaryButton} onPress={resetForm}>
                  <Text style={styles.secondaryButtonText}>{tUi('ui.mobile.common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.primaryActionButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.primaryButtonText}>
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

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
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
  promoTitleWrapRtl: {
    paddingRight: 0,
    paddingLeft: 10,
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

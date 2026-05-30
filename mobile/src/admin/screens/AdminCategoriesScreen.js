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
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS } from '../../config/api';
import Toast from 'react-native-toast-message';
import { confirmAction } from '../utils/confirm';

const emptyForm = {
  name: '',
  name_ar: '',
  name_fr: '',
  description: '',
  description_ar: '',
  description_fr: '',
};

const AdminCategoriesScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl } = useLanguage();
  const { textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(Array.isArray(response.data) ? response.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const list = term
      ? categories.filter((category) =>
          [
            category.name,
            category.name_ar,
            category.name_fr,
            category.description,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        )
      : categories;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [categories, searchQuery]);

  const openCreate = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setForm({
      name: category.name || '',
      name_ar: category.name_ar || '',
      name_fr: category.name_fr || '',
      description: category.description || '',
      description_ar: category.description_ar || '',
      description_fr: category.description_fr || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await http.put(CATEGORY_ENDPOINTS.UPDATE.replace('{id}', editingCategory.id), form);
      } else {
        await http.post(CATEGORY_ENDPOINTS.CREATE, form);
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingCategory(null);
      await fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminCategories.deleteCategory_be5e4141c7'),
      tUi('ui.pages.admin.adminCategories.areYouSureYouWant_cc06d151de'),
      tUi('ui.pages.admin.adminCategories.delete_d1c593a8bd'),
      tUi('ui.mobile.common.cancel')
    );
    if (!ok) return;
    try {
      await http.delete(CATEGORY_ENDPOINTS.DELETE.replace('{id}', category.id));
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.admin.adminCategories.categoryDeletedSuccessfully_af4e890bd7'),
      });
      fetchCategories();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || tUi('ui.toast.operationFailed'),
      });
    }
  };

  return (
    <AdminScreen
      title={tUi('ui.pages.admin.adminCategories.manageCategories_0cb9f43ae9')}
      subtitle={tUi('ui.pages.admin.adminCategories.subtitle_1a2b3c4d5e')}
      action={
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Feather name="plus" size={16} color={colors.surface} />
          <Text style={styles.primaryButtonText}>{tUi('ui.pages.admin.adminCategories.addCategoryBtn_6e7f8a9b0c')}</Text>
        </Pressable>
      }
    >
      <View style={[styles.searchRow, { flexDirection: row }]}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.admin.adminCategories.searchCategories_7a8b9c0d1e')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {filtered.map((category) => (
            <AdminListItem
              key={category.id}
              title={category.name}
              subtitle={category.description}
              meta={[category.name_ar, category.name_fr].filter(Boolean).join(' | ')}
              right={
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => openEdit(category)}>
                    <Text style={styles.inlineButton}>{tUi('ui.pages.admin.adminCategories.edit_36f0067e76')}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(category)}>
                    <Text style={[styles.inlineButton, styles.deleteButton]}>{tUi('ui.pages.admin.adminCategories.delete_d1c593a8bd')}</Text>
                  </Pressable>
                </View>
              }
            />
          ))}
          {!filtered.length ? (
            <Text style={styles.emptyText}>{tUi('ui.pages.admin.adminCategories.noSearchResults_8b9c0d1e2f')}</Text>
          ) : null}
        </View>
      )}

      <Modal transparent visible={showModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {editingCategory
                ? tUi('ui.pages.admin.adminCategories.editCategory_ce33b7c66f')
                : tUi('ui.pages.admin.adminCategories.addNewCategory_1a6cfcaeec')}
            </Text>
            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelName')}</Text>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder={tUi('ui.mobile.adminCategories.placeholderName')}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.modalRow}>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelNameAr')}</Text>
                <TextInput
                  style={[styles.input, inputRtlStyle]}
                  value={form.name_ar}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, name_ar: value }))}
                  placeholder={tUi('ui.mobile.adminCategories.placeholderNameAr')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelNameFr')}</Text>
                <TextInput
                  style={[styles.input, inputRtlStyle]}
                  value={form.name_fr}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, name_fr: value }))}
                  placeholder={tUi('ui.mobile.adminCategories.placeholderNameFr')}
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelDescription')}</Text>
              <TextInput
                style={[styles.input, styles.textArea, inputRtlStyle]}
                value={form.description}
                onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder={tUi('ui.mobile.adminCategories.placeholderDescription')}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>
            <View style={styles.modalRow}>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelDescriptionAr')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, inputRtlStyle]}
                  value={form.description_ar}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, description_ar: value }))}
                  placeholder={tUi('ui.mobile.adminCategories.placeholderDescriptionAr')}
                  placeholderTextColor={colors.muted}
                  multiline
                />
              </View>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>{tUi('ui.mobile.adminCategories.labelDescriptionFr')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, inputRtlStyle]}
                  value={form.description_fr}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, description_fr: value }))}
                  placeholder={tUi('ui.mobile.adminCategories.placeholderDescriptionFr')}
                  placeholderTextColor={colors.muted}
                  multiline
                />
              </View>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryButtonText}>{tUi('ui.mobile.common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? tUi('ui.mobile.common.saving') : tUi('ui.mobile.common.save')}
                </Text>
              </Pressable>
            </View>
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
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
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
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  inlineActions: {
    alignItems: 'flex-end',
  },
  inlineButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  deleteButton: {
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
  modalGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalColumn: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginRight: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
});

export default AdminCategoriesScreen;

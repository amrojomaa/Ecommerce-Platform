import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaPlus } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import http from '../../services/http';
import {
  CATEGORY_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  PROMOTION_ENDPOINTS,
  buildUrl
} from '../../config/api';
import { normalizeLanguageCode } from '../../i18n/constants';
import {
  resolveCategoryDisplayName,
  resolveProductDisplayName
} from '../../utils/localizedContent';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminPromotionsPage.css';
import '../../styles/pages/admin/AdminPromotions.css';

const FILTER_SELECTOR_META = {
  include_products: { entityPlural: 'products', entitySingular: 'product', mode: 'include' },
  exclude_products: { entityPlural: 'products', entitySingular: 'product', mode: 'exclude' },
  include_categories: { entityPlural: 'categories', entitySingular: 'category', mode: 'include' },
  exclude_categories: { entityPlural: 'categories', entitySingular: 'category', mode: 'exclude' }
};

const initialForm = {
  name: '',
  is_active: false,
  target_type: 'amount',
  target_value: '',
  discount_type: 'percentage',
  discount_value: '',
  filter_type: 'include_products',
  filter_values: []
};

const AdminPromotions = () => {
  const { t, i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  const filterLabels = useMemo(
    () => ({
      include_products: t('ui.pages.admin.adminPromotions.filterIncludeProducts_a8f3e2d1c0'),
      exclude_products: t('ui.pages.admin.adminPromotions.filterExcludeProducts_b9g4f3e2d1'),
      include_categories: t('ui.pages.admin.adminPromotions.filterIncludeCategories_c0h5g4f3e2'),
      exclude_categories: t('ui.pages.admin.adminPromotions.filterExcludeCategories_d1i6h5g4f3')
    }),
    [t]
  );

  const targetLabels = useMemo(
    () => ({
      amount: t('ui.pages.admin.adminPromotions.amount_3a1fe500a9'),
      quantity: t('ui.pages.admin.adminPromotions.quantity_d07d26e488')
    }),
    [t]
  );

  const discountLabels = useMemo(
    () => ({
      percentage: t('ui.pages.admin.adminPromotions.percentage_5c6ebe68e7'),
      fixed: t('ui.pages.admin.adminPromotions.fixedAmount_5c07c3eb56')
    }),
    [t]
  );

  const entityLabels = useMemo(
    () => ({
      products: t('ui.pages.admin.adminPromotions.entityProducts_e2j7i6h5g4'),
      product: t('ui.pages.admin.adminPromotions.entityProduct_f3k8j7i6h5'),
      categories: t('ui.pages.admin.adminPromotions.entityCategories_g4l9k8j7i6'),
      category: t('ui.pages.admin.adminPromotions.entityCategory_h5m0l9k8j7')
    }),
    [t]
  );

  const modeLabels = useMemo(
    () => ({
      include: t('ui.pages.admin.adminPromotions.modeInclude_i6n1m0l9k8'),
      exclude: t('ui.pages.admin.adminPromotions.modeExclude_j7o2n1m0l9')
    }),
    [t]
  );
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [optionSearch, setOptionSearch] = useState('');
  const isCreatePage = location.pathname.endsWith('/create');
  const basePath = location.pathname.startsWith('/seller') ? '/seller/promotions' : '/admin/promotions';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [promoRes, productsRes, categoriesRes] = await Promise.all([
        http.get(PROMOTION_ENDPOINTS.LIST),
        http.get(PRODUCT_ENDPOINTS.ALL_ADMIN, { params: { catalog_only: true } }),
        http.get(CATEGORY_ENDPOINTS.ALL),
      ]);
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const categories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      setPromotions(Array.isArray(promoRes.data) ? promoRes.data : []);
      setCatalogProducts(products);
      setCatalogCategories(categories);
      setProductOptions(products.map((product) => product.name).filter(Boolean));
      setCategoryOptions(categories.map((category) => category.name).filter(Boolean));
    } catch (error) {
      toast.error(error.message || t('ui.pages.admin.adminPromotions.failedToLoad_m0r5q4p3o2'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeFilterMeta = FILTER_SELECTOR_META[form.filter_type] || FILTER_SELECTOR_META.include_products;
  const activeEntityPlural = entityLabels[activeFilterMeta.entityPlural];
  const activeEntitySingular = entityLabels[activeFilterMeta.entitySingular];
  const activeModeLabel = modeLabels[activeFilterMeta.mode];
  const isProductFilter = activeFilterMeta.entityPlural === 'products';
  const rawOptions = isProductFilter ? productOptions : categoryOptions;
  const optionTerm = optionSearch.trim().toLowerCase();
  const getFilterValueLabel = useCallback(
    (canonicalName, entityPlural = activeFilterMeta.entityPlural) => {
      if (entityPlural === 'products') {
        return resolveProductDisplayName(catalogProducts, canonicalName, languageCode);
      }
      return resolveCategoryDisplayName(catalogCategories, canonicalName, languageCode);
    },
    [catalogProducts, catalogCategories, languageCode, activeFilterMeta.entityPlural]
  );

  const visibleOptions = useMemo(
    () =>
      rawOptions.filter((name) => {
        if (!optionTerm) return true;
        const label = getFilterValueLabel(name);
        return name.toLowerCase().includes(optionTerm) || label.toLowerCase().includes(optionTerm);
      }),
    [rawOptions, optionTerm, getFilterValueLabel]
  );
  const availableOptions = useMemo(
    () => visibleOptions.filter((name) => !form.filter_values.includes(name)),
    [visibleOptions, form.filter_values]
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setOptionSearch('');
  };

  useEffect(() => {
    if (isCreatePage) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreatePage]);

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addFilterValue = (value) => {
    if (!value) return;
    setForm((prev) => {
      if (prev.filter_values.includes(value)) return prev;
      return { ...prev, filter_values: [...prev.filter_values, value] };
    });
  };

  const removeFilterValue = (value) => {
    setForm((prev) => ({
      ...prev,
      filter_values: prev.filter_values.filter((entry) => entry !== value)
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return 'Name is required.';
    }
    if (!form.target_value || parseFloat(form.target_value) <= 0) {
      return 'Target value must be greater than zero.';
    }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) {
      return 'Discount value must be greater than zero.';
    }
    if (form.discount_type === 'percentage' && parseFloat(form.discount_value) > 100) {
      return 'Percentage discount cannot exceed 100.';
    }
    if (!form.filter_values.length) {
      return 'Select at least one product or category for the active filter.';
    }
    return null;
  };

  const submitPromotion = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      target_value: parseFloat(form.target_value),
      discount_value: parseFloat(form.discount_value)
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await http.put(buildUrl(PROMOTION_ENDPOINTS.UPDATE, { promotion_id: editingId }), payload);
        toast.success(t("ui.pages.admin.adminPromotions.promotionUpdated_3f8ee4a136"));
      } else {
        await http.post(PROMOTION_ENDPOINTS.CREATE, payload);
        toast.success(t("ui.pages.admin.adminPromotions.promotionCreated_6ec4515cf9"));
      }
      resetForm();
      await loadData();
      if (isCreatePage) {
        navigate(basePath);
      }
    } catch (error) {
      toast.error(error.message || t('ui.pages.admin.adminPromotions.failedToSave_n1s6r5q4p3'));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (promotion) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name || '',
      is_active: Boolean(promotion.is_active),
      target_type: promotion.target_type,
      target_value: promotion.target_value,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      filter_type: promotion.filter_type,
      filter_values: Array.isArray(promotion.filter_values) ? promotion.filter_values : []
    });
  };

  const removePromotion = async (promotion) => {
    const ok = await confirm({
      title: t("ui.pages.admin.adminPromotions.deletePromotion_038b26221a"),
      message: t('ui.pages.admin.adminPromotions.deletePromotionConfirm_l9q4p3o2n1', {
        value0: promotion.name
      }),
      confirmText: t("ui.pages.admin.adminPromotions.delete_54b841e5c7"),
      cancelText: t("ui.pages.admin.adminPromotions.cancel_5bfe37981f")
    });
    if (!ok) return;

    try {
      await http.delete(buildUrl(PROMOTION_ENDPOINTS.DELETE, { promotion_id: promotion.id }));
      toast.success(t("ui.pages.admin.adminPromotions.promotionDeleted_b08f0c57d3"));
      if (editingId === promotion.id) {
        resetForm();
      }
      await loadData();
    } catch (error) {
      toast.error(error.message || t('ui.pages.admin.adminPromotions.failedToDelete_o2t7s6r5q4'));
    }
  };

  const toggleActive = async (promotion) => {
    try {
      await http.patch(
        buildUrl(PROMOTION_ENDPOINTS.SET_ACTIVE, { promotion_id: promotion.id }),
        { is_active: !promotion.is_active }
      );
      toast.success(!promotion.is_active ? 'Promotion activated.' : 'Promotion deactivated.');
      await loadData();
    } catch (error) {
      toast.error(error.message || t('ui.pages.admin.adminPromotions.failedToUpdateActive_p3u8t7s6r5'));
    }
  };

  const promotionsTitle = t('ui.pages.admin.adminPromotions.promotions_8cc39c7561');
  const panelKicker = location.pathname.startsWith('/seller')
    ? t('ui.sidebar.panel.employee', { defaultValue: 'Seller' })
    : t('ui.sidebar.panel.admin');

  const renderForm = () => (
    <div className="adm-promo-panel">
      <form className="adm-promo-form" onSubmit={submitPromotion}>
        <div className="adm-promo-form-grid adm-promo-form-grid--3">
          <div className="adm-promo-field">
            <label htmlFor="promo-name">{t('ui.pages.admin.adminPromotions.promotionName_df0623c346')}</label>
            <input
              id="promo-name"
              type="text"
              value={form.name}
              onChange={(e) => setFormField('name', e.target.value)}
              placeholder={t('ui.pages.admin.adminPromotions.exampleWeekendFruitsDeal_29e2c6c9a5')}
            />
          </div>
          <div className="adm-promo-field">
            <label htmlFor="promo-target-type">{t('ui.pages.admin.adminPromotions.targetType_fefe0c8c35')}</label>
            <select
              id="promo-target-type"
              value={form.target_type}
              onChange={(e) => setFormField('target_type', e.target.value)}
            >
              <option value="amount">{t('ui.pages.admin.adminPromotions.amount_3a1fe500a9')}</option>
              <option value="quantity">{t('ui.pages.admin.adminPromotions.quantity_d07d26e488')}</option>
              </select>
          </div>
          <div className="adm-promo-field">
            <label htmlFor="promo-target-value">{t('ui.pages.admin.adminPromotions.targetValue_75b09d40c0')}</label>
              <input
              id="promo-target-value"
                type="number"
                min="0"
                step="0.01"
                value={form.target_value}
              onChange={(e) => setFormField('target_value', e.target.value)}
              placeholder={
                form.target_type === 'amount'
                  ? t('ui.pages.admin.adminPromotions.eG250_423fea402b')
                  : t('ui.pages.admin.adminPromotions.eG5_983cd1bfe4')
              }
            />
          </div>
          </div>

        <div className="adm-promo-form-grid">
          <div className="adm-promo-field">
            <label htmlFor="promo-discount-type">{t('ui.pages.admin.adminPromotions.discountType_01c9cdd79c')}</label>
            <select
              id="promo-discount-type"
              value={form.discount_type}
              onChange={(e) => setFormField('discount_type', e.target.value)}
            >
              <option value="percentage">{t('ui.pages.admin.adminPromotions.percentage_5c6ebe68e7')}</option>
              <option value="fixed">{t('ui.pages.admin.adminPromotions.fixedAmount_5c07c3eb56')}</option>
              </select>
          </div>
          <div className="adm-promo-field">
            <label htmlFor="promo-discount-value">{t('ui.pages.admin.adminPromotions.discountValue_e889384e6c')}</label>
              <input
              id="promo-discount-value"
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
              onChange={(e) => setFormField('discount_value', e.target.value)}
              placeholder={
                form.discount_type === 'percentage'
                  ? t('ui.pages.admin.adminPromotions.eG10_fea6ad1c95')
                  : t('ui.pages.admin.adminPromotions.eG50_6ed362485d')
              }
            />
          </div>
          </div>

        <div className="adm-promo-field">
          <label htmlFor="promo-filter-type">{t('ui.pages.admin.adminPromotions.activeFilterTypeOnlyOne_4810e3dfa9')}</label>
            <select
            id="promo-filter-type"
              value={form.filter_type}
              onChange={(e) => {
              setFormField('filter_type', e.target.value);
              setFormField('filter_values', []);
                setOptionSearch('');
            }}
          >
            {Object.entries(filterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                  {label}
                </option>
            ))}
            </select>
        </div>

        <div className="adm-promo-filter-box">
          <p className="adm-promo-filter-title">
            {t('ui.pages.admin.adminPromotions.selectEntitiesToMode_q4v9u8t7s6', {
              entities: activeEntityPlural,
              mode: activeModeLabel
            })}
          </p>

          <div className="adm-promo-form-grid">
            <div className="adm-promo-field">
              <label htmlFor="promo-option-search">
                {t('ui.pages.admin.adminPromotions.searchEntities_s6x1w0v9u8', {
                  entities: activeEntityPlural
                })}
              </label>
              <input
                id="promo-option-search"
                type="text"
                value={optionSearch}
                onChange={(e) => setOptionSearch(e.target.value)}
                placeholder={t('ui.pages.admin.adminPromotions.searchValue_2f91ef0392', {
                  value0: activeEntityPlural,
                })}
              />
            </div>

            <div className="adm-promo-field">
              <label htmlFor="promo-option-pick">
                {t('ui.pages.admin.adminPromotions.choose_fb5a4f9760')}
                {activeEntitySingular}
                {t('ui.pages.admin.adminPromotions.fromList_8b15d622c8')}
            </label>
              <select
                id="promo-option-pick"
                value=""
                onChange={(e) => {
                  addFilterValue(e.target.value);
                  e.target.value = '';
                }}
                disabled={availableOptions.length === 0}
              >
                <option value="">
                  {availableOptions.length
                    ? t('ui.pages.admin.adminPromotions.selectValue_7f5abf4ca9', {
                        value0: activeEntitySingular,
                      })
                    : t('ui.pages.admin.adminPromotions.noMoreValue_5e45337c69', {
                        value0: activeEntityPlural,
                      })}
                </option>
                {availableOptions.map((name) => (
                <option key={name} value={name}>
                    {getFilterValueLabel(name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="adm-promo-options-panel">
            {loading && rawOptions.length === 0 ? (
              <p className="adm-promo-empty-hint">
                {t('ui.pages.admin.adminPromotions.loadingEntities_r5w0v9u8t7', {
                  entities: activeEntityPlural
                })}
              </p>
            ) : form.filter_values.length === 0 ? (
              <p className="adm-promo-empty-hint">
                {t('ui.pages.admin.adminPromotions.noEntitySelected_k8p3o2n1m0', {
                  entities: activeEntityPlural
                })}
              </p>
            ) : (
              <div className="adm-promo-selected-list">
                {form.filter_values.map((value) => (
                <button
                  key={value}
                  type="button"
                    className="adm-promo-selected-item"
                    onClick={() => removeFilterValue(value)}
                  >
                      <span>{getFilterValueLabel(value)}</span>
                    <span aria-hidden>×</span>
                    </button>
                ))}
              </div>
                )}
          </div>
          </div>

        <label className="adm-promo-toggle">
            <input
              type="checkbox"
              checked={form.is_active}
            onChange={(e) => setFormField('is_active', e.target.checked)}
          />
          {t('ui.pages.admin.adminPromotions.setAsActivePromotion_5ae05ee309')}
          </label>

        <div className="adm-promo-form-actions">
          {(editingId || isCreatePage) && (
            <button type="button" className="adm-btn-secondary" onClick={resetForm} disabled={submitting}>
              {isCreatePage
                ? t('ui.pages.admin.adminPromotions.clearForm_de85c5d1ae')
                : t('ui.pages.admin.adminPromotions.cancelEdit_b35765164e')}
            </button>
          )}
          <button type="submit" className="adm-btn-primary" disabled={submitting}>
            {submitting
              ? t('ui.pages.admin.adminPromotions.saving_b9b5b0297e')
              : editingId
                ? t('ui.pages.admin.adminPromotions.updatePromotion_2382525a9a')
                : t('ui.pages.admin.adminPromotions.createPromotion_f093f3973d')}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="admin-page-shell admin-promotions adm-page adm-promotions-page">
      <PageHeader
        kicker={panelKicker}
        title={promotionsTitle}
        subtitle={t('ui.pages.admin.adminPromotions.createRuleBasedDiscountsFor_4ea978f98e')}
        actions={
          isCreatePage ? (
            <button type="button" className="adm-btn-secondary" onClick={() => navigate(basePath)}>
              {t('ui.pages.admin.adminPromotions.backToPromotions_1e790d9cc2')}
              </button>
          ) : (
            <motion.button
              type="button"
              className="adm-btn-primary"
              onClick={() => {
                resetForm();
                navigate(`${basePath}/create`);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaPlus aria-hidden />
              <span>{t('ui.pages.admin.adminPromotions.createPromotion_6315caab13')}</span>
            </motion.button>
          )
        }
      />

      {(isCreatePage || editingId !== null) && (
        <section className="adm-promo-section">
          <div className="adm-promo-section-header">
            <h2>
              {editingId
                ? t('ui.pages.admin.adminPromotions.editPromotion_c2740c715e')
                : t('ui.pages.admin.adminPromotions.createPromotion_f093f3973d')}
            </h2>
          </div>
          {renderForm()}
      </section>
      )}

      {!isCreatePage && (
        <section className="adm-promo-section">
          <div className="adm-promo-section-header">
            <h2>{t('ui.pages.admin.adminPromotions.existingPromotions_37326d3081')}</h2>
          </div>

          {loading ? (
            <div className="adm-promo-loading">
              <LoadingSpinner size="large" />
            </div>
          ) : promotions.length === 0 ? (
            <div className="adm-promo-empty">
              <p>{t('ui.pages.admin.adminPromotions.noPromotionsYet_258a69c574')}</p>
            </div>
          ) : (
            <div className="adm-promo-list">
              {promotions.map((promotion) => (
                <article
                  key={promotion.id}
                  className={`adm-promo-card ${promotion.is_active ? 'is-active' : ''}`}
                >
                  <div className="adm-promo-card-top">
                  <h3>{promotion.name}</h3>
                    {promotion.is_active && (
                      <span className="adm-promo-badge">
                        {t('ui.pages.admin.adminPromotions.active_9a948ffb7d')}
                      </span>
                    )}
                </div>
                  <p className="adm-promo-card-meta">
                    {t('ui.pages.admin.adminPromotions.target_5b3d89cb57')}{' '}
              <strong>{targetLabels[promotion.target_type]}</strong> &gt;= {promotion.target_value}
                </p>
                  <p className="adm-promo-card-meta">
                    {t('ui.pages.admin.adminPromotions.discount_3560202e5f')}{' '}
              <strong>{discountLabels[promotion.discount_type]}</strong> ({promotion.discount_value}
                    {promotion.discount_type === 'percentage' ? '%' : ''})
                  </p>
                  <p className="adm-promo-card-meta">
                    {t('ui.pages.admin.adminPromotions.filter_0e0778005a')}{' '}
                    <strong>{filterLabels[promotion.filter_type]}</strong> ({promotion.filter_values.length}{' '}
                    {t('ui.pages.admin.adminPromotions.selected_17a02c10f8')})
                  </p>

                  <div className="adm-promo-chips">
                    {promotion.filter_values.slice(0, 6).map((value) => {
                      const promotionFilterMeta =
                        FILTER_SELECTOR_META[promotion.filter_type] || FILTER_SELECTOR_META.include_products;
                      return (
                      <span key={`${promotion.id}-${value}`} className="adm-promo-chip">
                      {getFilterValueLabel(value, promotionFilterMeta.entityPlural)}
                    </span>
                      );
                    })}
                    {promotion.filter_values.length > 6 && (
                      <span className="adm-promo-chip">
                        +{promotion.filter_values.length - 6}
                        {t('ui.pages.admin.adminPromotions.more_dfeb47b490')}
                      </span>
                    )}
                </div>

                  <div className="adm-promo-card-actions">
                    <button type="button" className="adm-btn-primary" onClick={() => startEdit(promotion)}>
                      {t('ui.pages.admin.adminPromotions.edit_0a20314f38')}
              </button>
                    <button type="button" className="adm-btn-secondary" onClick={() => toggleActive(promotion)}>
                      {promotion.is_active
                        ? t('ui.pages.admin.adminPromotions.deactivate_193b47e6ea')
                        : t('ui.pages.admin.adminPromotions.activate_a5517419ad')}
                  </button>
                    <button type="button" className="adm-btn-danger" onClick={() => removePromotion(promotion)}>
                      {t('ui.pages.admin.adminPromotions.delete_54b841e5c7')}
              </button>
                </div>
              </article>
              ))}
            </div>
          )}
        </section>
          )}
          </div>
  );

};

export default AdminPromotions;

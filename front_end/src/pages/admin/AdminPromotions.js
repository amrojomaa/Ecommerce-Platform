import { tUi } from "../../i18n/uiText";import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PROMOTION_ENDPOINTS, buildUrl } from '../../config/api';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPromotions.css';

const FILTER_LABELS = {
  include_products: 'Include products',
  exclude_products: 'Exclude products',
  include_categories: 'Include categories',
  exclude_categories: 'Exclude categories'
};

const TARGET_LABELS = {
  amount: 'Amount',
  quantity: 'Quantity'
};

const DISCOUNT_LABELS = {
  percentage: 'Percentage',
  fixed: 'Fixed amount'
};

const FILTER_SELECTOR_META = {
  include_products: { entityPlural: 'products', entitySingular: 'product', modeLabel: 'include' },
  exclude_products: { entityPlural: 'products', entitySingular: 'product', modeLabel: 'exclude' },
  include_categories: { entityPlural: 'categories', entitySingular: 'category', modeLabel: 'include' },
  exclude_categories: { entityPlural: 'categories', entitySingular: 'category', modeLabel: 'exclude' }
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
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
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
      http.get(PROMOTION_ENDPOINTS.PRODUCT_OPTIONS),
      http.get(PROMOTION_ENDPOINTS.CATEGORY_OPTIONS)]
      );
      setPromotions(Array.isArray(promoRes.data) ? promoRes.data : []);
      setProductOptions(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCategoryOptions(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load promotions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeFilterMeta = FILTER_SELECTOR_META[form.filter_type] || FILTER_SELECTOR_META.include_products;
  const isProductFilter = activeFilterMeta.entityPlural === 'products';
  const rawOptions = isProductFilter ? productOptions : categoryOptions;
  const optionTerm = optionSearch.trim().toLowerCase();
  const visibleOptions = useMemo(
    () => rawOptions.filter((name) => name.toLowerCase().includes(optionTerm)),
    [rawOptions, optionTerm]
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
        toast.success(tUi("ui.pages.admin.adminPromotions.promotionUpdated_3f8ee4a136"));
      } else {
        await http.post(PROMOTION_ENDPOINTS.CREATE, payload);
        toast.success(tUi("ui.pages.admin.adminPromotions.promotionCreated_6ec4515cf9"));
      }
      resetForm();
      await loadData();
      if (isCreatePage) {
        navigate(basePath);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save promotion.');
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
      title: tUi("ui.pages.admin.adminPromotions.deletePromotion_038b26221a"),
      message: `Are you sure you want to delete "${promotion.name}"?`,
      confirmText: tUi("ui.pages.admin.adminPromotions.delete_54b841e5c7"),
      cancelText: tUi("ui.pages.admin.adminPromotions.cancel_5bfe37981f")
    });
    if (!ok) return;

    try {
      await http.delete(buildUrl(PROMOTION_ENDPOINTS.DELETE, { promotion_id: promotion.id }));
      toast.success(tUi("ui.pages.admin.adminPromotions.promotionDeleted_b08f0c57d3"));
      if (editingId === promotion.id) {
        resetForm();
      }
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete promotion.');
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
      toast.error(error.message || 'Failed to update active state.');
    }
  };

  const promotionsTitle = tUi("ui.pages.admin.adminPromotions.promotions_8cc39c7561");

  return (
    <div className="admin-page-shell admin-promotions">
      <header className="admin-promotions-header">
        <PageHeader
          kicker={promotionsTitle}
          title={promotionsTitle}
          subtitle={tUi("ui.pages.admin.adminPromotions.createRuleBasedDiscountsFor_4ea978f98e")}
          actions={
          isCreatePage ?
          <button
            type="button"
            className="promotion-header-btn btn-secondary"
            onClick={() => navigate(basePath)}>{tUi("ui.pages.admin.adminPromotions.backToPromotions_1e790d9cc2")}


          </button> :

          <button
            type="button"
            className="promotion-header-btn"
            onClick={() => {
              resetForm();
              navigate(`${basePath}/create`);
            }}>{tUi("ui.pages.admin.adminPromotions.createPromotion_6315caab13")}


          </button>
          }
        />
      </header>

      {(isCreatePage || editingId !== null) &&
      <section className="promotion-form-card">
        <h2>{editingId ? tUi("ui.pages.admin.adminPromotions.editPromotion_c2740c715e") : tUi("ui.pages.admin.adminPromotions.createPromotion_f093f3973d")}</h2>
        <form className="promotion-form" onSubmit={submitPromotion}>
          <label>{tUi("ui.pages.admin.adminPromotions.promotionName_df0623c346")}

            <input
              type="text"
              value={form.name}
              onChange={(e) => setFormField("name", e.target.value)}
              placeholder={tUi("ui.pages.admin.adminPromotions.exampleWeekendFruitsDeal_29e2c6c9a5")} />
            
          </label>

          <div className="promotion-form-grid">
            <label>{tUi("ui.pages.admin.adminPromotions.targetType_fefe0c8c35")}

              <select value={form.target_type} onChange={(e) => setFormField("target_type", e.target.value)}>
                <option value="amount">{tUi("ui.pages.admin.adminPromotions.amount_3a1fe500a9")}</option>
                <option value="quantity">{tUi("ui.pages.admin.adminPromotions.quantity_d07d26e488")}</option>
              </select>
            </label>
            <label>{tUi("ui.pages.admin.adminPromotions.targetValue_75b09d40c0")}

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.target_value}
                onChange={(e) => setFormField("target_value", e.target.value)}
                placeholder={form.target_type === "amount" ? tUi("ui.pages.admin.adminPromotions.eG250_423fea402b") : tUi("ui.pages.admin.adminPromotions.eG5_983cd1bfe4")} />
              
            </label>
          </div>

          <div className="promotion-form-grid">
            <label>{tUi("ui.pages.admin.adminPromotions.discountType_01c9cdd79c")}

              <select value={form.discount_type} onChange={(e) => setFormField("discount_type", e.target.value)}>
                <option value="percentage">{tUi("ui.pages.admin.adminPromotions.percentage_5c6ebe68e7")}</option>
                <option value="fixed">{tUi("ui.pages.admin.adminPromotions.fixedAmount_5c07c3eb56")}</option>
              </select>
            </label>
            <label>{tUi("ui.pages.admin.adminPromotions.discountValue_e889384e6c")}

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setFormField("discount_value", e.target.value)}
                placeholder={form.discount_type === "percentage" ? tUi("ui.pages.admin.adminPromotions.eG10_fea6ad1c95") : tUi("ui.pages.admin.adminPromotions.eG50_6ed362485d")} />
              
            </label>
          </div>

          <label>{tUi("ui.pages.admin.adminPromotions.activeFilterTypeOnlyOne_4810e3dfa9")}

            <select
              value={form.filter_type}
              onChange={(e) => {
                setFormField("filter_type", e.target.value);
                setFormField("filter_values", []);
                setOptionSearch('');
              }}>
              
              {Object.entries(FILTER_LABELS).map(([value, label]) =>
              <option key={value} value={value}>
                  {label}
                </option>
              )}
            </select>
          </label>

          <div className="promotion-filter-selector">
            <p className="promotion-filter-selector-title">{tUi("ui.pages.admin.adminPromotions.select_f53d6e97bb")}
              {activeFilterMeta.entityPlural} to {activeFilterMeta.modeLabel}
            </p>

            <label>{tUi("ui.pages.admin.adminPromotions.search_3ef2a27f22")}
              {activeFilterMeta.entityPlural}
              <input
                type="text"
                value={optionSearch}
                onChange={(e) => setOptionSearch(e.target.value)}
                placeholder={tUi("ui.pages.admin.adminPromotions.searchValue_2f91ef0392", { value0: activeFilterMeta.entityPlural })} />
              
            </label>

            <label>{tUi("ui.pages.admin.adminPromotions.choose_fb5a4f9760")}
              {activeFilterMeta.entitySingular}{tUi("ui.pages.admin.adminPromotions.fromList_8b15d622c8")}
              <select
                value=""
                onChange={(e) => {
                  addFilterValue(e.target.value);
                  e.target.value = '';
                }}
                disabled={availableOptions.length === 0}>
                
                <option value="">
                  {availableOptions.length ? tUi("ui.pages.admin.adminPromotions.selectValue_7f5abf4ca9", { value0:
                    activeFilterMeta.entitySingular }) : tUi("ui.pages.admin.adminPromotions.noMoreValue_5e45337c69", { value0:
                    activeFilterMeta.entityPlural })}
                </option>
                {availableOptions.map((name) =>
                <option key={name} value={name}>
                    {name}
                  </option>
                )}
              </select>
            </label>

            <div className="promotion-options-box">
              {loading && rawOptions.length === 0 ?
              <p className="promotion-empty-options">{tUi("ui.pages.admin.adminPromotions.loading_43f08352f4")}{activeFilterMeta.entityPlural}...</p> :
              form.filter_values.length === 0 ?
              <p className="promotion-empty-options">
                  No {activeFilterMeta.entityPlural}{tUi("ui.pages.admin.adminPromotions.selectedYet_4bd13349ac")}
              </p> :

              <div className="promotion-selected-list">
                  {form.filter_values.map((value) =>
                <button
                  key={value}
                  type="button"
                  className="promotion-selected-item"
                  onClick={() => removeFilterValue(value)}>
                  
                      <span>{value}</span>
                      <span className="promotion-selected-remove">x</span>
                    </button>
                )}
                </div>
              }
            </div>
          </div>

          <label className="promotion-active-toggle">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setFormField("is_active", e.target.checked)} />{tUi("ui.pages.admin.adminPromotions.setAsActivePromotion_5ae05ee309")}


          </label>

          <div className="promotion-form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? tUi("ui.pages.admin.adminPromotions.saving_b9b5b0297e") : editingId ? tUi("ui.pages.admin.adminPromotions.updatePromotion_2382525a9a") : tUi("ui.pages.admin.adminPromotions.createPromotion_f093f3973d")}
            </button>
            {(editingId || isCreatePage) &&
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={submitting}>
                {isCreatePage ? tUi("ui.pages.admin.adminPromotions.clearForm_de85c5d1ae") : tUi("ui.pages.admin.adminPromotions.cancelEdit_b35765164e")}
              </button>
            }
          </div>
        </form>
      </section>
      }

      {!isCreatePage &&
      <section className="promotion-list-card">
        <h2>{tUi("ui.pages.admin.adminPromotions.existingPromotions_37326d3081")}</h2>
        {loading ?
        <p>{tUi("ui.pages.admin.adminPromotions.loadingPromotions_23ddac97ba")}</p> :
        promotions.length === 0 ?
        <p>{tUi("ui.pages.admin.adminPromotions.noPromotionsYet_258a69c574")}</p> :

        <div className="promotion-list">
            {promotions.map((promotion) =>
          <article key={promotion.id} className={`promotion-item ${promotion.is_active ? 'active' : ''}`}>
                <div className="promotion-item-top">
                  <h3>{promotion.name}</h3>
                  {promotion.is_active && <span className="promotion-badge">{tUi("ui.pages.admin.adminPromotions.active_9a948ffb7d")}</span>}
                </div>
                <p>{tUi("ui.pages.admin.adminPromotions.target_5b3d89cb57")}
              <strong>{TARGET_LABELS[promotion.target_type]}</strong> &gt;= {promotion.target_value}
                </p>
                <p>{tUi("ui.pages.admin.adminPromotions.discount_3560202e5f")}
              <strong>{DISCOUNT_LABELS[promotion.discount_type]}</strong> ({promotion.discount_value}
                  {promotion.discount_type === "percentage" ? '%' : ''})
                </p>
                <p>{tUi("ui.pages.admin.adminPromotions.filter_0e0778005a")}
              <strong>{FILTER_LABELS[promotion.filter_type]}</strong> ({promotion.filter_values.length}{' '}{tUi("ui.pages.admin.adminPromotions.selected_17a02c10f8")}

            </p>

                <div className="promotion-chip-wrap">
                  {promotion.filter_values.slice(0, 6).map((value) =>
              <span key={`${promotion.id}-${value}`} className="promotion-chip">
                      {value}
                    </span>
              )}
                  {promotion.filter_values.length > 6 &&
              <span className="promotion-chip">+{promotion.filter_values.length - 6}{tUi("ui.pages.admin.adminPromotions.more_dfeb47b490")}</span>
              }
                </div>

                <div className="promotion-item-actions">
                  <button type="button" onClick={() => startEdit(promotion)}>{tUi("ui.pages.admin.adminPromotions.edit_0a20314f38")}

              </button>
                  <button type="button" className="btn-secondary" onClick={() => toggleActive(promotion)}>
                    {promotion.is_active ? tUi("ui.pages.admin.adminPromotions.deactivate_193b47e6ea") : tUi("ui.pages.admin.adminPromotions.activate_a5517419ad")}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => removePromotion(promotion)}>{tUi("ui.pages.admin.adminPromotions.delete_54b841e5c7")}

              </button>
                </div>
              </article>
          )}
          </div>
        }
      </section>
      }
    </div>);

};

export default AdminPromotions;

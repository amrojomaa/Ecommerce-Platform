import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PROMOTION_ENDPOINTS, buildUrl } from '../../config/api';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminPromotions.css';

const FILTER_LABELS = {
  include_products: 'Include products',
  exclude_products: 'Exclude products',
  include_categories: 'Include categories',
  exclude_categories: 'Exclude categories',
};

const TARGET_LABELS = {
  amount: 'Amount',
  quantity: 'Quantity',
};

const DISCOUNT_LABELS = {
  percentage: 'Percentage',
  fixed: 'Fixed amount',
};

const FILTER_SELECTOR_META = {
  include_products: { entityPlural: 'products', entitySingular: 'product', modeLabel: 'include' },
  exclude_products: { entityPlural: 'products', entitySingular: 'product', modeLabel: 'exclude' },
  include_categories: { entityPlural: 'categories', entitySingular: 'category', modeLabel: 'include' },
  exclude_categories: { entityPlural: 'categories', entitySingular: 'category', modeLabel: 'exclude' },
};

const initialForm = {
  name: '',
  is_active: false,
  target_type: 'amount',
  target_value: '',
  discount_type: 'percentage',
  discount_value: '',
  filter_type: 'include_products',
  filter_values: [],
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
      filter_values: prev.filter_values.filter((entry) => entry !== value),
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
      discount_value: parseFloat(form.discount_value),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await http.put(buildUrl(PROMOTION_ENDPOINTS.UPDATE, { promotion_id: editingId }), payload);
        toast.success('Promotion updated.');
      } else {
        await http.post(PROMOTION_ENDPOINTS.CREATE, payload);
        toast.success('Promotion created.');
      }
      resetForm();
      await loadData();
      if (isCreatePage) {
        navigate('/admin/promotions');
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
      filter_values: Array.isArray(promotion.filter_values) ? promotion.filter_values : [],
    });
  };

  const removePromotion = async (promotion) => {
    const ok = await confirm({
      title: 'Delete promotion',
      message: `Are you sure you want to delete "${promotion.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!ok) return;

    try {
      await http.delete(buildUrl(PROMOTION_ENDPOINTS.DELETE, { promotion_id: promotion.id }));
      toast.success('Promotion deleted.');
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

  return (
    <div className="admin-promotions">
      <header className="admin-promotions-header">
        <div className="admin-promotions-header-row">
          <div>
            <h1>Promotions</h1>
            <p>Create rule-based discounts for cart and POS using one active filter type per promotion.</p>
          </div>
          {isCreatePage ? (
            <button
              type="button"
              className="promotion-header-btn btn-secondary"
              onClick={() => navigate('/admin/promotions')}
            >
              Back to Promotions
            </button>
          ) : (
            <button
              type="button"
              className="promotion-header-btn"
              onClick={() => {
                resetForm();
                navigate('/admin/promotions/create');
              }}
            >
              Create Promotion
            </button>
          )}
        </div>
      </header>

      {(isCreatePage || editingId !== null) && (
      <section className="promotion-form-card">
        <h2>{editingId ? 'Edit promotion' : 'Create promotion'}</h2>
        <form className="promotion-form" onSubmit={submitPromotion}>
          <label>
            Promotion name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setFormField('name', e.target.value)}
              placeholder="Example: Weekend fruits deal"
            />
          </label>

          <div className="promotion-form-grid">
            <label>
              Target type
              <select value={form.target_type} onChange={(e) => setFormField('target_type', e.target.value)}>
                <option value="amount">Amount</option>
                <option value="quantity">Quantity</option>
              </select>
            </label>
            <label>
              Target value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.target_value}
                onChange={(e) => setFormField('target_value', e.target.value)}
                placeholder={form.target_type === 'amount' ? 'e.g. 250' : 'e.g. 5'}
              />
            </label>
          </div>

          <div className="promotion-form-grid">
            <label>
              Discount type
              <select value={form.discount_type} onChange={(e) => setFormField('discount_type', e.target.value)}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>
              Discount value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setFormField('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
              />
            </label>
          </div>

          <label>
            Active filter type (only one)
            <select
              value={form.filter_type}
              onChange={(e) => {
                setFormField('filter_type', e.target.value);
                setFormField('filter_values', []);
                setOptionSearch('');
              }}
            >
              {Object.entries(FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="promotion-filter-selector">
            <p className="promotion-filter-selector-title">
              Select {activeFilterMeta.entityPlural} to {activeFilterMeta.modeLabel}
            </p>

            <label>
              Search {activeFilterMeta.entityPlural}
              <input
                type="text"
                value={optionSearch}
                onChange={(e) => setOptionSearch(e.target.value)}
                placeholder={`Search ${activeFilterMeta.entityPlural}...`}
              />
            </label>

            <label>
              Choose {activeFilterMeta.entitySingular} from list
              <select
                value=""
                onChange={(e) => {
                  addFilterValue(e.target.value);
                  e.target.value = '';
                }}
                disabled={availableOptions.length === 0}
              >
                <option value="">
                  {availableOptions.length
                    ? `Select ${activeFilterMeta.entitySingular}`
                    : `No more ${activeFilterMeta.entityPlural}`}
                </option>
                {availableOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <div className="promotion-options-box">
              {loading && rawOptions.length === 0 ? (
                <p className="promotion-empty-options">Loading {activeFilterMeta.entityPlural}...</p>
              ) : form.filter_values.length === 0 ? (
                <p className="promotion-empty-options">
                  No {activeFilterMeta.entityPlural} selected yet.
                </p>
              ) : (
                <div className="promotion-selected-list">
                  {form.filter_values.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="promotion-selected-item"
                      onClick={() => removeFilterValue(value)}
                    >
                      <span>{value}</span>
                      <span className="promotion-selected-remove">x</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="promotion-active-toggle">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setFormField('is_active', e.target.checked)}
            />
            Set as active promotion
          </label>

          <div className="promotion-form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update promotion' : 'Create promotion'}
            </button>
            {(editingId || isCreatePage) && (
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={submitting}>
                {isCreatePage ? 'Clear form' : 'Cancel edit'}
              </button>
            )}
          </div>
        </form>
      </section>
      )}

      {!isCreatePage && (
      <section className="promotion-list-card">
        <h2>Existing promotions</h2>
        {loading ? (
          <p>Loading promotions...</p>
        ) : promotions.length === 0 ? (
          <p>No promotions yet.</p>
        ) : (
          <div className="promotion-list">
            {promotions.map((promotion) => (
              <article key={promotion.id} className={`promotion-item ${promotion.is_active ? 'active' : ''}`}>
                <div className="promotion-item-top">
                  <h3>{promotion.name}</h3>
                  {promotion.is_active && <span className="promotion-badge">Active</span>}
                </div>
                <p>
                  Target: <strong>{TARGET_LABELS[promotion.target_type]}</strong> &gt;= {promotion.target_value}
                </p>
                <p>
                  Discount: <strong>{DISCOUNT_LABELS[promotion.discount_type]}</strong> ({promotion.discount_value}
                  {promotion.discount_type === 'percentage' ? '%' : ''})
                </p>
                <p>
                  Filter: <strong>{FILTER_LABELS[promotion.filter_type]}</strong> ({promotion.filter_values.length}{' '}
                  selected)
                </p>

                <div className="promotion-chip-wrap">
                  {promotion.filter_values.slice(0, 6).map((value) => (
                    <span key={`${promotion.id}-${value}`} className="promotion-chip">
                      {value}
                    </span>
                  ))}
                  {promotion.filter_values.length > 6 && (
                    <span className="promotion-chip">+{promotion.filter_values.length - 6} more</span>
                  )}
                </div>

                <div className="promotion-item-actions">
                  <button type="button" onClick={() => startEdit(promotion)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => toggleActive(promotion)}>
                    {promotion.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => removePromotion(promotion)}>
                    Delete
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

import { tUi } from '../../i18n/uiText';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaMagnifyingGlass, FaPercent, FaPlus } from 'react-icons/fa6';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS } from '../../config/api';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import { getCatalogImageUrl } from '../../utils/helpers';
import { normalizeLanguageCode } from '../../i18n/constants';
import { localizeProduct, productMatchesLocalizedSearch } from '../../utils/localizedContent';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminDiscounts.css';

const initialForm = {
  product_id: '',
  discount_enabled: true,
  discount_type: 'percentage',
  discount_value: ''
};

const AdminDiscounts = () => {
  const { t, i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [productSearch, setProductSearch] = useState('');
  const [listSearch, setListSearch] = useState('');

  const isCreatePage = location.pathname.endsWith('/create');
  const basePath = '/admin/discounts';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN, {
        params: { catalog_only: true },
      });
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminDiscounts.failedToFetchProductsFor_b7ed6e5511'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setProductSearch('');
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

  const discountedProducts = useMemo(
    () => products.filter((product) => product.discount_enabled),
    [products]
  );

  const listTerm = listSearch.trim();
  const filteredDiscounts = useMemo(() => {
    const matched = !listTerm
      ? [...discountedProducts]
      : discountedProducts.filter((product) => productMatchesLocalizedSearch(product, listTerm, languageCode));
    return matched.sort((a, b) =>
      localizeProduct(a, languageCode).localized_name.localeCompare(
        localizeProduct(b, languageCode).localized_name
      )
    );
  }, [discountedProducts, listTerm, languageCode]);

  const pickTerm = productSearch.trim();
  const selectableProducts = useMemo(() => {
    const pool = isCreatePage
      ? products.filter((product) => !product.discount_enabled)
      : products;
    if (!pickTerm) return pool;
    return pool.filter((product) => productMatchesLocalizedSearch(product, pickTerm, languageCode));
  }, [products, pickTerm, isCreatePage, languageCode]);

  const selectedProduct = useMemo(() => {
    const id = editingId || form.product_id;
    if (!id) return null;
    return products.find((product) => String(product.id) === String(id)) || null;
  }, [products, editingId, form.product_id]);

  const localizedSelectedProduct = useMemo(
    () => (selectedProduct ? localizeProduct(selectedProduct, languageCode) : null),
    [selectedProduct, languageCode]
  );

  const validateForm = () => {
    const productId = editingId || form.product_id;
    if (!productId) {
      return tUi('ui.pages.admin.adminDiscounts.selectProductRequired_8f2a1c3b4d');
    }
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) {
      return tUi('ui.pages.admin.adminDiscounts.selectProductRequired_8f2a1c3b4d');
    }
    if (!form.discount_enabled) return null;
    if (form.discount_value === '' || form.discount_value === null || form.discount_value === undefined) {
      return 'Discount value is required when discount is enabled.';
    }
    const parsedValue = parseFloat(form.discount_value);
    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return 'Discount value must be greater than 0.';
    }
    if (!['percentage', 'fixed'].includes(form.discount_type)) {
      return 'Select a valid discount type.';
    }
    if (form.discount_type === 'percentage' && parsedValue > 100) {
      return 'Percentage discount cannot be more than 100%.';
    }
    if (form.discount_type === 'fixed' && parsedValue > parseFloat(product.price)) {
      return 'Fixed discount cannot exceed the original price.';
    }
    return null;
  };

  const submitDiscount = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const productId = editingId || form.product_id;
    setSubmitting(true);
    try {
      await http.patch(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT.replace('{id}', productId), {
        discount_enabled: Boolean(form.discount_enabled),
        discount_type: form.discount_enabled ? form.discount_type : null,
        discount_value: form.discount_enabled ? parseFloat(form.discount_value || 0) : 0
      });
      const product = products.find((p) => String(p.id) === String(productId));
      toast.success(
        editingId
          ? tUi('ui.pages.admin.adminDiscounts.discountUpdated_4c8e2a1f90')
          : tUi('ui.pages.admin.adminDiscounts.discountCreated_7b3d9e2a11')
      );
      resetForm();
      await fetchProducts();
      if (isCreatePage) {
        navigate(basePath);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save discount');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setForm({
      product_id: product.id,
      discount_enabled: Boolean(product.discount_enabled),
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value ?? ''
    });
    setProductSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeDiscount = async (product) => {
    const ok = await confirm({
      title: tUi('ui.pages.admin.adminDiscounts.removeDiscount_2a9f4e8c01'),
      message: `${tUi('ui.pages.admin.adminDiscounts.removeDiscountConfirm_5d1e7b3a92')} "${localizeProduct(product, languageCode).localized_name}"?`,
      confirmText: tUi('ui.pages.admin.adminDiscounts.removeDiscount_2a9f4e8c01'),
      cancelText: tUi('ui.pages.admin.adminPromotions.cancel_5bfe37981f')
    });
    if (!ok) return;

    try {
      await http.patch(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT.replace('{id}', product.id), {
        discount_enabled: false,
        discount_type: null,
        discount_value: 0
      });
      toast.success(tUi('ui.pages.admin.adminDiscounts.discountRemoved_9e4c2b1a77'));
      if (editingId === product.id) {
        resetForm();
      }
      await fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove discount');
    }
  };

  const getDiscountLabel = (product) => {
    if (!product.discount_enabled) return '—';
    const suffix = product.discount_type === 'percentage' ? '%' : '';
    return `${product.discount_type === 'percentage' ? tUi('ui.pages.admin.adminDiscounts.percentage_1355234c87') : tUi('ui.pages.admin.adminDiscounts.fixedAmount_17d721b6a9')} (${product.discount_value}${suffix})`;
  };

  const discountsTitle = tUi('ui.pages.admin.adminDiscounts.discounts_5acbd929a0');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });

  const renderForm = () => (
    <div className="adm-discount-panel">
      <form className="adm-discount-form" onSubmit={submitDiscount}>
        {!editingId && (
          <div className="adm-discount-form-grid">
            <div className="adm-discount-field">
              <label htmlFor="discount-product-search">
                {tUi('ui.pages.admin.adminDiscounts.searchProducts_1a2b3c4d5e')}{' '}
                {tUi('ui.pages.admin.adminDiscounts.productsLabel_6f7e8d9c0a')}
              </label>
              <input
                id="discount-product-search"
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={tUi('ui.pages.admin.adminDiscounts.searchByProductNameOr_231a9422f6')}
              />
            </div>
            <div className="adm-discount-field">
              <label htmlFor="discount-product-pick">
                {tUi('ui.pages.admin.adminPromotions.choose_fb5a4f9760')}
                {tUi('ui.pages.admin.adminDiscounts.productLabel_3b4c5d6e7f')}
                {tUi('ui.pages.admin.adminPromotions.fromList_8b15d622c8')}
              </label>
              <select
                id="discount-product-pick"
                value={form.product_id}
                onChange={(e) => setFormField('product_id', e.target.value)}
                disabled={selectableProducts.length === 0}
              >
                <option value="">
                  {selectableProducts.length
                    ? tUi('ui.pages.admin.adminDiscounts.selectProductOption_8a9b0c1d2e')
                    : tUi('ui.pages.admin.adminDiscounts.noProductsAvailable_4e5f6a7b8c')}
                </option>
                {selectableProducts.map((product) => {
                  const localized = localizeProduct(product, languageCode);
                  return (
                  <option key={product.id} value={product.id}>
                    {localized.localized_name} ({localized.localized_category_name})
                  </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {selectedProduct && localizedSelectedProduct && (
          <div className="adm-discount-selected-product">
            <div className="adm-discount-selected-media">
              <img
                src={
                  selectedProduct.images?.length > 0
                    ? getCatalogImageUrl(selectedProduct.images[0])
                    : getCatalogImageUrl('/images/placeholder.jpg')
                }
                alt={localizedSelectedProduct.localized_name}
              />
            </div>
            <div className="adm-discount-selected-meta">
              <h3>{localizedSelectedProduct.localized_name}</h3>
              <p>{localizedSelectedProduct.localized_category_name}</p>
              <p>
                {tUi('ui.pages.orders.price_c9e823260b')}{' '}
                <strong>{formatCurrency(selectedProduct.price)}</strong>
              </p>
            </div>
          </div>
        )}

        <div className="adm-discount-form-grid">
          <div className="adm-discount-field">
            <label htmlFor="discount-type">{tUi('ui.pages.admin.adminPromotions.discountType_01c9cdd79c')}</label>
            <select
              id="discount-type"
              value={form.discount_type}
              onChange={(e) => setFormField('discount_type', e.target.value)}
              disabled={!form.discount_enabled}
            >
              <option value="percentage">{tUi('ui.pages.admin.adminDiscounts.percentage_d8edf1d60e')}</option>
              <option value="fixed">{tUi('ui.pages.admin.adminDiscounts.fixedAmount_17d721b6a9')}</option>
            </select>
          </div>
          <div className="adm-discount-field">
            <label htmlFor="discount-value">{tUi('ui.pages.admin.adminPromotions.discountValue_e889384e6c')}</label>
            <input
              id="discount-value"
              type="number"
              min="0"
              step="0.01"
              value={form.discount_value}
              onChange={(e) => setFormField('discount_value', e.target.value)}
              disabled={!form.discount_enabled}
              placeholder={
                form.discount_type === 'percentage'
                  ? tUi('ui.pages.admin.adminDiscounts.eG15_654d286fe1')
                  : tUi('ui.pages.admin.adminDiscounts.eG2550_a1fe96880e')
              }
            />
          </div>
        </div>

        <label className="adm-discount-toggle">
          <input
            type="checkbox"
            checked={form.discount_enabled}
            onChange={(e) => setFormField('discount_enabled', e.target.checked)}
          />
          {tUi('ui.pages.admin.adminDiscounts.enableDiscount_a54df19510')}
        </label>

        <div className="adm-discount-form-actions">
          {(editingId || isCreatePage) && (
            <button
              type="button"
              className="adm-btn-secondary"
              onClick={() => {
                resetForm();
                if (isCreatePage) navigate(basePath);
              }}
              disabled={submitting}
            >
              {isCreatePage
                ? tUi('ui.pages.admin.adminPromotions.clearForm_de85c5d1ae')
                : tUi('ui.pages.admin.adminPromotions.cancelEdit_b35765164e')}
            </button>
          )}
          <button type="submit" className="adm-btn-primary" disabled={submitting}>
            {submitting
              ? tUi('ui.pages.admin.adminDiscounts.saving_03e4229f21')
              : editingId
                ? tUi('ui.pages.admin.adminDiscounts.updateDiscount_1f2e3d4c5b')
                : tUi('ui.pages.admin.adminDiscounts.createDiscountSubmit_9a8b7c6d5e')}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="admin-page-shell adm-page adm-discounts-page">
      <PageHeader
        kicker={panelKicker}
        title={discountsTitle}
        subtitle={tUi('ui.pages.admin.adminDiscounts.manageAllProductDiscountsFrom_052f906975')}
        actions={
          isCreatePage ? (
            <button type="button" className="adm-btn-secondary" onClick={() => navigate(basePath)}>
              {tUi('ui.pages.admin.adminDiscounts.backToDiscounts_2b3c4d5e6f')}
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
              <span>{tUi('ui.pages.admin.adminDiscounts.createDiscountBtn_7a8b9c0d1e')}</span>
            </motion.button>
          )
        }
      />

      {(isCreatePage || editingId !== null) && (
        <section className="adm-discount-section">
          <div className="adm-discount-section-header">
            <h2>
              {editingId
                ? tUi('ui.pages.admin.adminDiscounts.editDiscount_3c4d5e6f7a')
                : tUi('ui.pages.admin.adminDiscounts.createDiscountTitle_8b9c0d1e2f')}
            </h2>
          </div>
          {renderForm()}
        </section>
      )}

      {!isCreatePage && (
        <section className="adm-discount-section">
          <div className="adm-discount-section-header">
            <h2>{tUi('ui.pages.admin.adminDiscounts.existingDiscounts_4d5e6f7a8b')}</h2>
          </div>

          <div className="adm-discount-toolbar">
            <div className="adm-discount-search-wrap">
              <div className="adm-discount-search">
                <FaMagnifyingGlass className="adm-discount-search-icon" aria-hidden />
        <input
          type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder={tUi('ui.pages.admin.adminDiscounts.searchByProductNameOr_231a9422f6')}
                />
                {listSearch.trim() ? (
                  <button type="button" className="adm-discount-search-clear" onClick={() => setListSearch('')}>
                    {tUi('ui.pages.admin.adminDiscounts.clear_66301d428d')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="adm-discount-loading">
              <LoadingSpinner size="large" />
            </div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="adm-discount-empty">
              <FaPercent className="adm-discount-empty-icon" aria-hidden />
              <p>
                {listTerm
                  ? tUi('ui.pages.admin.adminDiscounts.noProductsMatchYourSearch_ddd67f60ff')
                  : tUi('ui.pages.admin.adminDiscounts.noDiscountsYet_5e6f7a8b9c')}
              </p>
              {!listTerm && (
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
                  <span>{tUi('ui.pages.admin.adminDiscounts.createDiscountBtn_7a8b9c0d1e')}</span>
                </motion.button>
              )}
      </div>
          ) : (
            <div className="adm-discount-list">
              {filteredDiscounts.map((product) => {
                const localized = localizeProduct(product, languageCode);
                const finalPrice = product.discounted_price ?? product.price;
          return (
                  <article key={product.id} className="adm-discount-list-card is-discounted">
                    <div className="adm-discount-list-card-media">
                      <img
                        src={
                          product.images?.length > 0
                            ? getCatalogImageUrl(product.images[0])
                            : getCatalogImageUrl('/images/placeholder.jpg')
                        }
                        alt={localized.localized_name}
                      />
                </div>
                    <div className="adm-discount-list-card-body">
                      <div className="adm-discount-list-card-top">
                  <h3>{localized.localized_name}</h3>
                        <span className="adm-discount-list-badge">
                          {tUi('ui.pages.admin.adminProducts.discount_e4537e1136')}
                    </span>
                  </div>
                      <p className="adm-discount-list-meta">{localized.localized_category_name}</p>
                      <p className="adm-discount-list-meta">
                        {tUi('ui.pages.admin.adminPromotions.discount_3560202e5f')}{' '}
                        <strong>{getDiscountLabel(product)}</strong>
                      </p>
                      <p className="adm-discount-list-meta">
                        {formatCurrency(product.price)} →{' '}
                        <strong className="adm-discount-list-price">{formatCurrency(finalPrice)}</strong>
                      </p>
                      <div className="adm-discount-list-actions">
                        <button type="button" className="adm-btn-primary" onClick={() => startEdit(product)}>
                          {tUi('ui.pages.admin.adminPromotions.edit_0a20314f38')}
                        </button>
                        <button type="button" className="adm-btn-danger" onClick={() => removeDiscount(product)}>
                          {tUi('ui.pages.admin.adminDiscounts.removeDiscount_2a9f4e8c01')}
                  </button>
                </div>
                    </div>
                  </article>
                );
        })}
        </div>
          )}
        </section>
      )}
        </div>
  );
};

export default AdminDiscounts;

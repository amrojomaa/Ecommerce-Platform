import { tUi } from "../../i18n/uiText";import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS } from '../../config/api';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { useCurrency } from '../../hooks/useCurrency';
import { getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminDiscounts.css';

const AdminDiscounts = () => {
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const buildDraft = (product) => ({
    discount_enabled: Boolean(product.discount_enabled),
    discount_type: product.discount_type || 'percentage',
    discount_value: product.discount_value ?? 0
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const fetchedProducts = response.data || [];
      setProducts(fetchedProducts);
      const initialDrafts = {};
      fetchedProducts.forEach((product) => {
        initialDrafts[product.id] = buildDraft(product);
      });
      setDrafts(initialDrafts);
    } catch (error) {
      toast.error(tUi("ui.pages.admin.adminDiscounts.failedToFetchProductsFor_b7ed6e5511"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDraftChange = (productId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const validateDraft = (product, draft) => {
    if (!draft.discount_enabled) return null;
    if (draft.discount_value === '' || draft.discount_value === null || draft.discount_value === undefined) {
      return 'Discount value is required when discount is enabled.';
    }
    const parsedValue = parseFloat(draft.discount_value);
    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return 'Discount value must be greater than 0.';
    }
    if (!['percentage', 'fixed'].includes(draft.discount_type)) {
      return 'Select a valid discount type.';
    }
    if (draft.discount_type === 'percentage' && parsedValue > 100) {
      return 'Percentage discount cannot be more than 100%.';
    }
    if (draft.discount_type === 'fixed' && parsedValue > parseFloat(product.price)) {
      return 'Fixed discount cannot exceed the original price.';
    }
    return null;
  };

  const handleSaveDiscount = async (product) => {
    const draft = drafts[product.id] || buildDraft(product);
    const validationError = validateDraft(product, draft);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSavingId(product.id);
    try {
      await http.patch(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT.replace('{id}', product.id), {
        discount_enabled: Boolean(draft.discount_enabled),
        discount_type: draft.discount_enabled ? draft.discount_type : null,
        discount_value: draft.discount_enabled ? parseFloat(draft.discount_value || 0) : 0
      });
      toast.success(`Discount updated for ${product.name}`);
      await fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update discount');
    } finally {
      setSavingId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matchedProducts = !term ?
    [...products] :
    products.filter((product) =>
    product.name.toLowerCase().includes(term) ||
    product.category_name.toLowerCase().includes(term)
    );

    // Keep products with active discounts at the top.
    return matchedProducts.sort((a, b) => {
      if (a.discount_enabled === b.discount_enabled) {
        return a.name.localeCompare(b.name);
      }
      return a.discount_enabled ? -1 : 1;
    });
  }, [products, searchTerm]);

  return (
    <div className="admin-discounts">
      <div className="admin-discounts-header">
        <h1>{tUi("ui.pages.admin.adminDiscounts.discounts_5acbd929a0")}</h1>
        <p>{tUi("ui.pages.admin.adminDiscounts.manageAllProductDiscountsFrom_052f906975")}</p>
      </div>

      <div className="discounts-search">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={tUi("ui.pages.admin.adminDiscounts.searchByProductNameOr_231a9422f6")} />
        
        <button
          type="button"
          className="discounts-search-clear"
          onClick={() => setSearchTerm('')}
          disabled={!searchTerm.trim()}>{tUi("ui.pages.admin.adminDiscounts.clear_66301d428d")}


        </button>
      </div>

      {loading ?
      <div className="discounts-grid">
          {[...Array(8)].map((_, i) =>
        <ProductCardSkeleton key={i} />
        )}
        </div> :

      <div className="discounts-grid">
          {filteredProducts.map((product, index) => {
          const draft = drafts[product.id] || buildDraft(product);
          const finalPrice = product.discount_enabled ? product.discounted_price ?? product.price : product.price;
          return (
            <motion.div
              key={product.id}
              className="discount-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}>
              
                <div className="discount-card-image">
                  <img
                  src={product.images && product.images.length > 0 ?
                  getImageUrl(product.images[0]) :
                  getImageUrl('/images/placeholder.jpg')}
                  alt={product.name} />
                
                </div>
                <div className="discount-card-body">
                  <h3>{product.name}</h3>
                  <p className="discount-category">{product.category_name}</p>

                  <div className="discount-prices">
                    <span className="price-before">{formatCurrency(product.price)}</span>
                    <span className={`price-after ${product.discount_enabled ? 'active' : ''}`}>
                      {formatCurrency(finalPrice)}
                    </span>
                  </div>

                  <label className="discount-toggle-row">
                    <input
                    type="checkbox"
                    checked={draft.discount_enabled}
                    onChange={(e) => handleDraftChange(product.id, "discount_enabled", e.target.checked)} />{tUi("ui.pages.admin.adminDiscounts.enableDiscount_a54df19510")}


                </label>

                  <div className="discount-controls">
                    <select
                    value={draft.discount_type}
                    onChange={(e) => handleDraftChange(product.id, "discount_type", e.target.value)}
                    disabled={!draft.discount_enabled}>
                    
                      <option value="percentage">{tUi("ui.pages.admin.adminDiscounts.percentage_d8edf1d60e")}</option>
                      <option value="fixed">{tUi("ui.pages.admin.adminDiscounts.fixedAmount_17d721b6a9")}</option>
                    </select>

                    <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.discount_value}
                    onChange={(e) => handleDraftChange(product.id, "discount_value", e.target.value)}
                    disabled={!draft.discount_enabled}
                    placeholder={draft.discount_type === "percentage" ? tUi("ui.pages.admin.adminDiscounts.eG15_654d286fe1") : tUi("ui.pages.admin.adminDiscounts.eG2550_a1fe96880e")} />
                  
                  </div>

                  <button
                  className="save-discount-btn"
                  onClick={() => handleSaveDiscount(product)}
                  disabled={savingId === product.id}>
                  
                    {savingId === product.id ? tUi("ui.pages.admin.adminDiscounts.saving_03e4229f21") : tUi("ui.pages.admin.adminDiscounts.saveDiscount_daa834be56")}
                  </button>
                </div>
              </motion.div>);

        })}
          {filteredProducts.length === 0 &&
        <div className="discounts-empty">{tUi("ui.pages.admin.adminDiscounts.noProductsMatchYourSearch_ddd67f60ff")}

        </div>
        }
        </div>
      }
    </div>);

};

export default AdminDiscounts;

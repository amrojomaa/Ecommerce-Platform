import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaMagnifyingGlass, FaPlus, FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, CATEGORY_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import ProductFormModal from '../../components/ProductFormModal';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import { getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminProductsModal.css';
import '../../styles/pages/admin/AdminDiscounts.css';
import '../../styles/pages/seller/SellerPanel.css';
import '../../styles/pages/seller/SellerProducts.css';

const SellerProducts = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const confirm = useConfirm();
  const panelKicker = t('ui.sidebar.panel.seller');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountProduct, setDiscountProduct] = useState(null);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    discount_enabled: false,
    discount_type: 'percentage',
    discount_value: '',
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(res.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(tUi('ui.pages.seller.sellerProducts.loadFailed_b1c2d3e4f5'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(res.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || p.category_name === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (quantity) => {
    if (quantity === 0) return 'out';
    if (quantity < 10) return 'low';
    return 'ok';
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const openDiscountModal = (product) => {
    setDiscountProduct(product);
    setDiscountForm({
      discount_enabled: product.discount_enabled,
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value ? String(product.discount_value) : '',
    });
    setShowDiscountModal(true);
  };

  const handleSaveDiscount = async () => {
    if (!discountProduct) return;

    setSavingDiscount(true);
    try {
      await http.patch(buildUrl(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT, { id: discountProduct.id }), {
        discount_enabled: discountForm.discount_enabled,
        discount_type: discountForm.discount_type,
        discount_value: discountForm.discount_enabled ? parseFloat(discountForm.discount_value) || 0 : 0,
      });
      toast.success(tUi('ui.pages.seller.sellerProducts.discountUpdated_v1w2x3y4z5'));
      setShowDiscountModal(false);
      setDiscountProduct(null);
      fetchProducts();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDelete = async (product) => {
    const confirmed = await confirm({
      title: tUi('ui.pages.seller.sellerProducts.deleteTitle_k6l7m8n9o0'),
      message: tUi('ui.pages.seller.sellerProducts.deleteMessage_p1q2r3s4t5', { value0: product.name }),
      confirmText: tUi('ui.pages.seller.sellerProducts.deleteConfirm_u6v7w8x9y0'),
      cancelText: tUi('ui.pages.seller.sellerProducts.deleteCancel_z1a2b3c4d5'),
    });
    if (!confirmed) return;

    try {
      await http.delete(buildUrl(PRODUCT_ENDPOINTS.DELETE, { id: product.id }));
      toast.success(tUi('ui.pages.seller.sellerProducts.productDeleted_e6f7g8h9i0'));
      fetchProducts();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Delete failed';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page slr-page slr-products-page">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.seller.sellerProducts.title_j1k2l3m4n5')}
        subtitle={tUi('ui.pages.seller.sellerProducts.subtitle_o6p7q8r9s0')}
        actions={
          <div className="slr-products-header-actions">
            <motion.button
              type="button"
              className="adm-btn-primary"
              onClick={openCreateModal}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaPlus aria-hidden />
              {tUi('ui.pages.seller.sellerProducts.addProduct_t1u2v3w4x5')}
            </motion.button>
            <select
              id="slr-products-category-filter"
              className="adm-orders-select slr-products-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label={tUi('ui.pages.seller.sellerProducts.allCategories_d1e2f3g4h5')}
            >
              <option value="">{tUi('ui.pages.seller.sellerProducts.allCategories_d1e2f3g4h5')}</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <section className="adm-section slr-products-section">
        <div className="slr-toolbar slr-products-toolbar">
          <div className="slr-search-wrap">
            <FaMagnifyingGlass className="slr-search-icon" aria-hidden />
            <input
              type="search"
              className="slr-search-input"
              placeholder={tUi('ui.pages.seller.sellerProducts.searchPlaceholder_y6z7a8b9c0')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="adm-page-empty slr-products-empty">
            <p>
              {products.length === 0
                ? tUi('ui.pages.seller.sellerProducts.emptyNoProducts_i6j7k8l9m0')
                : tUi('ui.pages.seller.sellerProducts.emptyNoMatch_n1o2p3q4r5')}
            </p>
          </div>
        ) : (
          <div className="slr-data-panel">
            <div className="slr-table-scroll">
              <table className="slr-products-table">
                <thead>
                  <tr>
                    <th>{tUi('ui.pages.seller.sellerProducts.colImage_s6t7u8v9w0')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colProduct_x1y2z3a4b5')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colCategory_c6d7e8f9g0')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colPrice_h1i2j3k4l5')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colDiscount_m6n7o8p9q0')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colStock_r1s2t3u4v5')}</th>
                    <th>{tUi('ui.pages.seller.sellerProducts.colActions_w6x7y8z9a0')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <td>
                        <div className="slr-product-thumb">
                          <img
                            src={
                              product.images?.length
                                ? getImageUrl(product.images[0])
                                : getImageUrl('/images/placeholder.jpg')
                            }
                            alt=""
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                            }}
                          />
                        </div>
                      </td>
                      <td className="slr-product-name">{product.name}</td>
                      <td>{product.category_name}</td>
                      <td>
                        {product.discount_enabled && product.discounted_price < product.price ? (
                          <span className="slr-price-stack">
                            <span className="slr-price-old">{formatCurrency(product.price)}</span>
                            <span className="slr-price-sale">{formatCurrency(product.discounted_price)}</span>
                          </span>
                        ) : (
                          formatCurrency(product.price)
                        )}
                      </td>
                      <td>
                        {product.discount_enabled ? (
                          <span className="slr-discount-badge">
                            {product.discount_type === 'percentage'
                              ? `${product.discount_value}%`
                              : formatCurrency(product.discount_value)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`slr-stock-badge slr-stock-badge--${getStockStatus(product.quantity)}`}>
                          {product.quantity === 0
                            ? tUi('ui.pages.seller.sellerProducts.stockOut_b1c2d3e4f5')
                            : product.quantity}
                        </span>
                      </td>
                      <td>
                        <div className="slr-row-actions">
                          <button type="button" className="adm-btn-secondary slr-row-btn" onClick={() => openEditModal(product)}>
                            {tUi('ui.pages.seller.sellerProducts.edit_g6h7i8j9k0')}
                          </button>
                          <button type="button" className="adm-btn-secondary slr-row-btn" onClick={() => openDiscountModal(product)}>
                            {tUi('ui.pages.seller.sellerProducts.discount_l1m2n3o4p5')}
                          </button>
                          <button type="button" className="adm-btn-secondary slr-row-btn slr-row-btn--danger" onClick={() => handleDelete(product)}>
                            {tUi('ui.pages.seller.sellerProducts.delete_q6r7s8t9u0')}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ProductFormModal
        isOpen={showProductModal}
        onClose={closeProductModal}
        onSaved={fetchProducts}
        editingProduct={editingProduct}
        categories={categories}
        setCategories={setCategories}
        panelKicker={panelKicker}
      />

      {showDiscountModal && discountProduct && (
        <div className="admin-modal-overlay slr-discount-modal-overlay" onClick={() => !savingDiscount && setShowDiscountModal(false)}>
          <div className="admin-modal slr-discount-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="slr-discount-modal-title">
            <header className="slr-discount-modal-header">
              <div>
                <span className="page-kicker">{panelKicker}</span>
                <h2 id="slr-discount-modal-title">{tUi('ui.pages.seller.sellerProducts.modalDiscountTitle_f1g2h3i4j5')}</h2>
                <p className="slr-discount-modal-subtitle">{discountProduct.name}</p>
              </div>
              <button
                type="button"
                className="adm-product-modal-close"
                onClick={() => setShowDiscountModal(false)}
                aria-label={tUi('ui.pages.seller.sellerProducts.cancel_h1i2j3k4l5')}
              >
                <FaXmark aria-hidden />
              </button>
            </header>

            <div className="slr-discount-modal-body">
              <div className="adm-discount-selected-product slr-discount-selected-product">
                <div className="adm-discount-selected-media">
                  <img
                    src={
                      discountProduct.images?.length
                        ? getImageUrl(discountProduct.images[0])
                        : getImageUrl('/images/placeholder.jpg')
                    }
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                    }}
                  />
                </div>
                <div className="adm-discount-selected-meta">
                  <h3>{discountProduct.name}</h3>
                  <p>{discountProduct.category_name}</p>
                  <p>
                    {tUi('ui.pages.seller.sellerProducts.fieldPrice_u6v7w8x9y0')}{' '}
                    <strong>{formatCurrency(discountProduct.price)}</strong>
                  </p>
                </div>
              </div>

              <div className="slr-discount-enable-card">
                <div className="slr-discount-enable-copy">
                  <strong>{tUi('ui.pages.seller.sellerProducts.enableDiscount_i6j7k8l9m0')}</strong>
                  <span>{tUi('ui.pages.seller.sellerProducts.enableDiscountHint_a1b2c3d4e5')}</span>
                </div>
                <label className="slr-discount-switch">
                  <input
                    type="checkbox"
                    checked={discountForm.discount_enabled}
                    onChange={(e) => setDiscountForm({ ...discountForm, discount_enabled: e.target.checked })}
                  />
                  <span className="slr-discount-switch-track" aria-hidden="true">
                    <span className="slr-discount-switch-thumb" />
                  </span>
                  <span className="slr-discount-switch-state">
                    {discountForm.discount_enabled
                      ? tUi('ui.pages.seller.sellerProducts.discountOn_f6g7h8i9j0')
                      : tUi('ui.pages.seller.sellerProducts.discountOff_k1l2m3n4o5')}
                  </span>
                </label>
              </div>

              <div className={`adm-discount-form-grid slr-discount-form-grid ${discountForm.discount_enabled ? '' : 'is-disabled'}`}>
                <div className="adm-discount-field">
                  <label htmlFor="slr-discount-type">{tUi('ui.pages.seller.sellerProducts.discountType_n1o2p3q4r5')}</label>
                  <select
                    id="slr-discount-type"
                    value={discountForm.discount_type}
                    onChange={(e) => setDiscountForm({ ...discountForm, discount_type: e.target.value })}
                    disabled={!discountForm.discount_enabled}
                  >
                    <option value="percentage">{tUi('ui.pages.seller.sellerProducts.discountPercent_s6t7u8v9w0')}</option>
                    <option value="fixed">{tUi('ui.pages.seller.sellerProducts.discountFixed_x1y2z3a4b5')}</option>
                  </select>
                </div>
                <div className="adm-discount-field">
                  <label htmlFor="slr-discount-value">{tUi('ui.pages.seller.sellerProducts.discountValue_c6d7e8f9g0')}</label>
                  <input
                    id="slr-discount-value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountForm.discount_value}
                    onChange={(e) => setDiscountForm({ ...discountForm, discount_value: e.target.value })}
                    disabled={!discountForm.discount_enabled}
                    placeholder={
                      discountForm.discount_type === 'percentage'
                        ? tUi('ui.pages.admin.adminDiscounts.eG15_654d286fe1')
                        : tUi('ui.pages.admin.adminDiscounts.eG2550_a1fe96880e')
                    }
                  />
                </div>
              </div>
            </div>

            <div className="adm-discount-form-actions slr-discount-form-actions">
              <button type="button" className="adm-btn-secondary" onClick={() => setShowDiscountModal(false)} disabled={savingDiscount}>
                {tUi('ui.pages.seller.sellerProducts.cancel_h1i2j3k4l5')}
              </button>
              <button type="button" className="adm-btn-primary" onClick={handleSaveDiscount} disabled={savingDiscount}>
                {savingDiscount
                  ? tUi('ui.pages.seller.sellerProducts.saving_m6n7o8p9q0')
                  : tUi('ui.pages.seller.sellerProducts.saveChanges_w6x7y8z9a0')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;

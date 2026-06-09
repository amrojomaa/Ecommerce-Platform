import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, CATEGORY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/seller/SellerPanel.css';
import '../../styles/pages/seller/SellerProducts.css';

const SellerProducts = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const panelKicker = t('ui.sidebar.panel.seller');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN, {
        params: { catalog_only: true },
      });
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
        subtitle={tUi('ui.pages.seller.sellerProducts.subtitleViewOnly_a9b8c7d6e5')}
        actions={
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
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SellerProducts;

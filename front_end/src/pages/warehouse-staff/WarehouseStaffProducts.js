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
import '../../styles/pages/warehouse-staff/WarehouseStaffPanel.css';
import '../../styles/pages/warehouse-staff/WarehouseStaffProducts.css';

const WarehouseStaffProducts = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const panelKicker = t('ui.sidebar.panel.warehouseStaff');

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
      toast.error(tUi('ui.pages.warehouseStaff.warehouseStaffProducts.loadFailed_a1b2c3d4e5'));
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
    <div className="admin-page-shell adm-page wms-page wms-products-page">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.title_f6g7h8i9j0')}
        subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.subtitle_k1l2m3n4o5')}
        actions={
          <select
            id="wms-products-category-filter"
            className="adm-orders-select wms-products-category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.allCategories_p5q6r7s8t9')}
          >
            <option value="">{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.allCategories_p5q6r7s8t9')}</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      <section className="adm-section wms-products-section">
        <div className="wms-toolbar wms-products-toolbar">
          <div className="wms-search-wrap">
            <FaMagnifyingGlass className="wms-search-icon" aria-hidden />
            <input
              type="search"
              className="wms-search-input"
              placeholder={tUi('ui.pages.warehouseStaff.warehouseStaffProducts.searchPlaceholder_u0v1w2x3y4')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="adm-page-empty wms-products-empty">
            <p>
              {products.length === 0
                ? tUi('ui.pages.warehouseStaff.warehouseStaffProducts.emptyNoProducts_z5a6b7c8d9')
                : tUi('ui.pages.warehouseStaff.warehouseStaffProducts.emptyNoMatch_e0f1g2h3i4')}
            </p>
          </div>
        ) : (
          <div className="wms-products-data-panel">
            <div className="wms-table-scroll">
              <table className="wms-products-table">
                <thead>
                  <tr>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colImage_j5k6l7m8n9')}</th>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colProduct_o0p1q2r3s4')}</th>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colCategory_t5u6v7w8x9')}</th>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colPrice_y0z1a2b3c4')}</th>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colDiscount_d5e6f7g8h9')}</th>
                    <th>{tUi('ui.pages.warehouseStaff.warehouseStaffProducts.colStock_i0j1k2l3m4')}</th>
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
                        <div className="wms-product-thumb">
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
                      <td className="wms-product-name">{product.name}</td>
                      <td>{product.category_name}</td>
                      <td>
                        {product.discount_enabled && product.discounted_price < product.price ? (
                          <span className="wms-price-stack">
                            <span className="wms-price-old">{formatCurrency(product.price)}</span>
                            <span className="wms-price-sale">{formatCurrency(product.discounted_price)}</span>
                          </span>
                        ) : (
                          formatCurrency(product.price)
                        )}
                      </td>
                      <td>
                        {product.discount_enabled ? (
                          <span className="wms-discount-badge">
                            {product.discount_type === 'percentage'
                              ? `${product.discount_value}%`
                              : formatCurrency(product.discount_value)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`wms-stock-badge wms-stock-badge--${getStockStatus(product.quantity)}`}>
                          {product.quantity === 0
                            ? tUi('ui.pages.warehouseStaff.warehouseStaffProducts.stockOut_n5o6p7q8r9')
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

export default WarehouseStaffProducts;

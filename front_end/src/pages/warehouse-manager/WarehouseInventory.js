import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, WAREHOUSE_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { getImageUrl } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseInventory.css';

const STOCK_FILTERS = ['', 'in', 'low', 'out'];

const WarehouseInventory = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const panelKicker = t('ui.sidebar.panel.warehouse');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [editingStock, setEditingStock] = useState({});
  const [savingStock, setSavingStock] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(t('ui.pages.warehouse.warehouseInventory.toast.failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchThreshold = useCallback(async () => {
    try {
      const res = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      setLowStockThreshold(res.data.threshold);
    } catch (e) {
      /* default */
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchThreshold();
  }, [fetchProducts, fetchThreshold]);

  useEffect(() => {
    const stock = searchParams.get('stock');
    if (stock === 'low' || stock === 'out' || stock === 'in') {
      setStockFilter(stock);
    } else if (!stock) {
      setStockFilter('');
    }
  }, [searchParams]);

  const handleStockFilterChange = (value) => {
    setStockFilter(value);
    if (!value) {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ stock: value }, { replace: true });
  };

  const formatStockFilterLabel = (value) => {
    if (value === 'in') return t('ui.pages.warehouse.warehouseInventory.filter.inStock');
    if (value === 'low') return t('ui.pages.warehouse.warehouseInventory.filter.lowStock');
    if (value === 'out') return t('ui.pages.warehouse.warehouseInventory.filter.outOfStock');
    return t('ui.pages.warehouse.warehouseInventory.filter.all');
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.quantity > 0 && p.quantity < lowStockThreshold;
    else if (stockFilter === 'out') matchesStock = p.quantity === 0;
    else if (stockFilter === 'in') matchesStock = p.quantity >= lowStockThreshold;
    return matchesSearch && matchesStock;
  });

  const getStockStatus = (qty) => {
    if (qty === 0) return 'out-of-stock';
    if (qty < lowStockThreshold) return 'low-stock';
    return 'in-stock';
  };

  const handleStockChange = (productId, value) => {
    setEditingStock((prev) => ({ ...prev, [productId]: value }));
  };

  const handleSaveStock = async (productId) => {
    const newQty = parseInt(editingStock[productId], 10);
    if (Number.isNaN(newQty) || newQty < 0) {
      toast.error(t('ui.pages.warehouse.warehouseInventory.toast.invalidQuantity'));
      return;
    }
    setSavingStock(productId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.UPDATE_STOCK, { product_id: productId }), {
        quantity: newQty,
      });
      toast.success(t('ui.pages.warehouse.warehouseInventory.toast.stockUpdated'));
      setEditingStock((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      fetchProducts();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || t('ui.pages.warehouse.warehouseInventory.toast.failedToUpdateStock')
      );
    } finally {
      setSavingStock(null);
    }
  };

  const productCountLabel =
    filteredProducts.length === 1
      ? t('ui.pages.warehouse.warehouseInventory.productCountOne')
      : t('ui.pages.warehouse.warehouseInventory.productCountMany');

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page wm-page wm-inventory-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.warehouse.warehouseInventory.title')}
        subtitle={t('ui.pages.warehouse.warehouseInventory.subtitle')}
        actions={
          <div className="adm-orders-header-filter wm-inventory-header-filter">
            <div className="adm-orders-filter-row">
              <label className="adm-orders-filter-label" htmlFor="wm-inventory-stock-filter">
                {t('ui.pages.warehouse.warehouseInventory.filterByStock')}
              </label>
              <select
                id="wm-inventory-stock-filter"
                className="adm-orders-select wm-inventory-select"
                value={stockFilter}
                onChange={(e) => handleStockFilterChange(e.target.value)}
              >
                {STOCK_FILTERS.map((value) => (
                  <option key={value || 'all'} value={value}>
                    {formatStockFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-orders-header-meta" aria-live="polite">
              <strong>{filteredProducts.length}</strong> {productCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-section wm-inventory-section">
        <div className="wm-toolbar wm-inventory-toolbar">
          <div className="wm-search-wrap">
            <FaMagnifyingGlass className="wm-search-icon" aria-hidden />
            <input
              type="search"
              className="wm-search-input"
              placeholder={t('ui.pages.warehouse.warehouseInventory.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="adm-page-empty wm-page-empty">
            <p>{t('ui.pages.warehouse.warehouseInventory.empty')}</p>
          </div>
        ) : (
          <motion.div
            className="wm-data-panel wm-inventory-data-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="wm-table-scroll">
              <table className="wm-inventory-table">
                <thead>
                  <tr>
                    <th>{t('ui.pages.warehouse.warehouseInventory.table.product')}</th>
                    <th>{t('ui.pages.warehouse.warehouseInventory.table.category')}</th>
                    <th>{t('ui.pages.warehouse.warehouseInventory.table.price')}</th>
                    <th>{t('ui.pages.warehouse.warehouseInventory.table.status')}</th>
                    <th>{t('ui.pages.warehouse.warehouseInventory.table.stock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isEditing = editingStock[product.id] !== undefined;
                    const imageSrc = product.images?.[0] ? getImageUrl(product.images[0]) : null;
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="wm-product-cell">
                            {imageSrc ? (
                              <img
                                src={imageSrc}
                                alt=""
                                className="wm-product-thumb"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                                }}
                              />
                            ) : (
                              <div className="wm-product-thumb wm-product-thumb--empty" aria-hidden>
                                <FiPackage />
                              </div>
                            )}
                            <span className="wm-product-name">{product.name}</span>
                          </div>
                        </td>
                        <td>{product.category_name}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>
                          <span className={`wm-stock-badge ${getStockStatus(product.quantity)}`}>
                            {t(`ui.pages.warehouse.warehouseInventory.status.${getStockStatus(product.quantity)}`)}
                          </span>
                        </td>
                        <td>
                          <div className="wm-stock-cell">
                            <input
                              className="wm-stock-input"
                              type="number"
                              min="0"
                              value={isEditing ? editingStock[product.id] : product.quantity}
                              onChange={(e) => handleStockChange(product.id, e.target.value)}
                              onFocus={() => {
                                if (!isEditing) handleStockChange(product.id, String(product.quantity));
                              }}
                              aria-label={t('ui.pages.warehouse.warehouseInventory.table.stock')}
                            />
                            {isEditing && parseInt(editingStock[product.id], 10) !== product.quantity && (
                              <button
                                type="button"
                                className="adm-btn-primary wm-stock-save-btn"
                                onClick={() => handleSaveStock(product.id)}
                                disabled={savingStock === product.id}
                              >
                                {savingStock === product.id
                                  ? t('ui.pages.warehouse.warehouseInventory.button.saving')
                                  : t('ui.pages.warehouse.warehouseInventory.button.save')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default WarehouseInventory;

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/warehouse-manager/WarehouseInventory.css';

const WarehouseInventory = () => {
  const { t } = useTranslation();
const { formatCurrency } = useCurrency();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [editingStock, setEditingStock] = useState({}); // { productId: newQty }
  const [savingStock, setSavingStock] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(res.data);
    } catch (error) {
      toast.error(t('ui.pages.warehouse.warehouseInventory.toast.failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.quantity > 0 && p.quantity < 10;
    else if (stockFilter === 'out') matchesStock = p.quantity === 0;
    else if (stockFilter === 'in') matchesStock = p.quantity >= 10;
    return matchesSearch && matchesStock;
  });
  // Apply stock filter from URL query param
  useEffect(() => {
    const stock = searchParams.get('stock');
    if (stock === 'low' || stock === 'out' || stock === 'in') {
      setStockFilter(stock);
    }
  }, [searchParams]);

  const getStockStatus = (qty) => {
    if (qty === 0) return 'out-of-stock';
    if (qty < 10) return 'low-stock';
    return 'in-stock';
  };

  const handleStockChange = (productId, value) => {
    setEditingStock(prev => ({ ...prev, [productId]: value }));
  };

  const handleSaveStock = async (productId) => {
    const newQty = parseInt(editingStock[productId]);
    if (isNaN(newQty) || newQty < 0) {
      toast.error(t('ui.pages.warehouse.warehouseInventory.toast.invalidQuantity'));
      return;
    }
    setSavingStock(productId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.UPDATE_STOCK, { product_id: productId }), { quantity: newQty });
      toast.success(t('ui.pages.warehouse.warehouseInventory.toast.stockUpdated'));
      setEditingStock(prev => { const n = { ...prev }; delete n[productId]; return n; });
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.pages.warehouse.warehouseInventory.toast.failedToUpdateStock'));
    } finally {
      setSavingStock(null);
    }
  };

  if (loading) return <div className="page-loading wm-inventory-loading"><LoadingSpinner size="large" /></div>;

  const inventoryTitle = t('ui.pages.warehouse.warehouseInventory.title');

  return (
    <div className="admin-page-shell wm-inventory">
      <PageHeader kicker={inventoryTitle} title={inventoryTitle} />
      <div className="wm-inventory-filters">
        <input
          type="text"
          placeholder={t('ui.pages.warehouse.warehouseInventory.searchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
          <option value="">{t('ui.pages.warehouse.warehouseInventory.filter.all')}</option>
          <option value="in">{t('ui.pages.warehouse.warehouseInventory.filter.inStock')}</option>
          <option value="low">{t('ui.pages.warehouse.warehouseInventory.filter.lowStock')}</option>
          <option value="out">{t('ui.pages.warehouse.warehouseInventory.filter.outOfStock')}</option>
        </select>
      </div>
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
          {filteredProducts.map(product => {
            const isEditing = editingStock[product.id] !== undefined;
            return (
              <tr key={product.id}>
                <td style={{ fontWeight: 600 }}>{product.name}</td>
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
                      onChange={e => handleStockChange(product.id, e.target.value)}
                      onFocus={() => { if (!isEditing) handleStockChange(product.id, String(product.quantity)); }}
                    />
                    {isEditing && parseInt(editingStock[product.id]) !== product.quantity && (
                      <button className="wm-stock-save-btn" onClick={() => handleSaveStock(product.id)} disabled={savingStock === product.id}>
                        {savingStock === product.id ? '...' : t('ui.pages.warehouse.warehouseInventory.button.save')}
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
  );
};

export default WarehouseInventory;

import React, { useState, useEffect, useCallback } from 'react';
import { FiCreditCard, FiDollarSign, FiPackage, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { POS_ENDPOINTS, CATEGORY_ENDPOINTS } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import { localizeCategoryName } from '../../utils/localizedContent';
import { useCashierPos } from '../../context/CashierPosContext';
import '../../styles/pages/cashier/PosTerminal.css';

const thumbUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${normalized}`;
};

const PosTerminal = () => {
  const { i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const cashierPos = useCashierPos();
  const search = cashierPos?.search ?? '';
  const [category, setCategory] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [promotionSummary, setPromotionSummary] = useState({
    subtotal: 0,
    promotion_discount: 0,
    grand_total: 0,
    applied_promotion: null,
  });

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const { data } = await http.get(POS_ENDPOINTS.PRODUCTS, {
        params: { q: search.trim(), category: category.trim() },
      });
      setCatalog(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load products');
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [search, category]);

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const { data } = await http.get(POS_ENDPOINTS.SALES_TODAY);
      setTodaySales(Array.isArray(data) ? data : []);
    } catch {
      setTodaySales([]);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await http.get(CATEGORY_ENDPOINTS.ALL);
      const sorted = (Array.isArray(data) ? data : [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllCategories(sorted);
    } catch {
      setAllCategories([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchCatalog(), 300);
    return () => clearTimeout(timer);
  }, [fetchCatalog]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (cashierPos?.historyRequestId) {
      setShowHistoryModal(true);
    }
  }, [cashierPos?.historyRequestId]);

  useEffect(() => {
    if (lines.length === 0) {
      setShowPaymentStep(false);
    }
  }, [lines.length]);

  const todayRevenue = todaySales.reduce(
    (sum, sale) => sum + (parseFloat(sale.total_amount) || 0),
    0
  );

  const addProduct = (p) => {
    if (p.quantity < 1) {
      toast.warn(tUi('ui.pages.cashier.posTerminal.outOfStock_1bf2a299b1'));
      return;
    }
    setLines((prev) => {
      const i = prev.findIndex((x) => x.product_id === p.id);
      if (i >= 0) {
        const next = [...prev];
        const row = next[i];
        if (row.quantity + 1 > p.quantity) {
          toast.warn(`Only ${p.quantity} in stock for ${p.name}`);
          return prev;
        }
        next[i] = { ...row, quantity: row.quantity + 1 };
        return next;
      }
      return [...prev, { product_id: p.id, name: p.name, unit: p.discounted_price, maxStock: p.quantity, quantity: 1 }];
    });
  };

  const adjustQty = (productId, delta) => {
    setLines((prev) =>
      prev.map((row) => {
        if (row.product_id !== productId) return row;
        let newQty = row.quantity + delta;
        if (newQty < 1) newQty = 1;
        if (newQty > row.maxStock) {
          toast.warn(`Quantity capped at ${row.maxStock} for ${row.name}`);
          newQty = row.maxStock;
        }
        return { ...row, quantity: newQty };
      })
    );
  };

  const removeLine = (productId) => {
    setLines((prev) => prev.filter((r) => r.product_id !== productId));
  };

  const refreshPromotionPreview = useCallback(async (currentLines) => {
    if (!currentLines.length) {
      setPromotionSummary({
        subtotal: 0,
        promotion_discount: 0,
        grand_total: 0,
        applied_promotion: null,
      });
      return;
    }

    try {
      const { data } = await http.post(POS_ENDPOINTS.PROMOTION_PREVIEW, {
        items: currentLines.map(({ product_id, quantity }) => ({ product_id, quantity })),
      });
      setPromotionSummary({
        subtotal: Number(data?.subtotal || 0),
        promotion_discount: Number(data?.promotion_discount || 0),
        grand_total: Number(data?.grand_total || 0),
        applied_promotion: data?.applied_promotion || null,
      });
    } catch {
      const fallbackSubtotal = currentLines.reduce((s, row) => s + row.unit * row.quantity, 0);
      setPromotionSummary({
        subtotal: fallbackSubtotal,
        promotion_discount: 0,
        grand_total: fallbackSubtotal,
        applied_promotion: null,
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPromotionPreview(lines);
    }, 250);
    return () => clearTimeout(timer);
  }, [lines, refreshPromotionPreview]);

  const completeSale = async (method) => {
    setSubmitting(true);
    try {
      const { data } = await http.post(POS_ENDPOINTS.SALE, {
        items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        payment_method: method,
        customer_name: customerName || null,
      });
      const saved = Number(data?.promotion_discount || 0);
      if (saved > 0) {
        toast.success(`Sale completed. Promotion saved ${formatCurrency(saved)}.`);
      } else {
        toast.success(tUi('ui.pages.cashier.posTerminal.saleCompleted_09843ea178'));
      }
      setLines([]);
      setCustomerName('');
      setShowPaymentStep(false);
      fetchToday();
      fetchCatalog();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteClick = () => {
    if (lines.length === 0) {
      toast.warn(tUi('ui.pages.cashier.posTerminal.addItemsToTheSale_5c282636c6'));
      return;
    }
    setShowPaymentStep(true);
  };

  const handlePaymentSelect = async (method) => {
    await completeSale(method);
  };

  const previewGrandTotal = promotionSummary.grand_total;
  const lineCount = lines.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="pos-shell">
      <div className="pos-catalog-column">
        <header className="pos-toolbar">
          <div
            className="pos-category-tabs"
            role="tablist"
            aria-label={tUi('ui.pages.cashier.posTerminal.filterCategory_93d0a059ec')}
          >
            <button
              type="button"
              role="tab"
              className={`pos-category-tab${category === '' ? ' is-active' : ''}`}
              aria-selected={category === ''}
              onClick={() => setCategory('')}
            >
              {tUi('ui.pages.cashier.posTerminal.allCategories_0c74d6af15')}
            </button>
            {allCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                className={`pos-category-tab${category === c.name ? ' is-active' : ''}`}
                aria-selected={category === c.name}
                onClick={() => setCategory(c.name)}
              >
                {localizeCategoryName(c, i18n.language)}
              </button>
            ))}
          </div>
        </header>

        <section className="pos-catalog" aria-label={tUi('ui.pages.cashier.posTerminal.searchProducts_ac70437f7f')}>
          <div className="pos-catalog-head">
            <p className="pos-catalog-count">
              {tUi('ui.pages.cashier.posTerminal.productsAvailable_g7h8i9j0k1', { count: catalog.length })}
            </p>
            <p className="pos-catalog-revenue">
              {tUi('ui.pages.cashier.posTerminal.todaysRevenue_a1b2c3d4e5')}:{' '}
              <strong>{formatCurrency(todayRevenue)}</strong>
            </p>
          </div>

          {loadingCatalog ? (
            <div className="pos-loading">
              <LoadingSpinner size="medium" />
            </div>
          ) : catalog.length === 0 ? (
            <div className="pos-empty-catalog">
              <FiPackage size={40} aria-hidden />
              <p>{tUi('ui.pages.cashier.posTerminal.noProductsFound_f6a7b8c9d0')}</p>
            </div>
          ) : (
            <div className="pos-product-grid">
              {catalog.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pos-product-card"
                  onClick={() => addProduct(p)}
                  disabled={p.quantity < 1}
                >
                  <div className="pos-product-thumb">
                    {p.images?.[0] ? (
                      <img src={thumbUrl(p.images[0])} alt="" loading="lazy" />
                    ) : (
                      <span className="pos-no-img">{tUi('ui.pages.cashier.posTerminal.noImage_bbc5075c44')}</span>
                    )}
                    {p.quantity < 1 && (
                      <span className="pos-out-badge">{tUi('ui.pages.cashier.posTerminal.outOfStock_1bf2a299b1')}</span>
                    )}
                  </div>
                  <div className="pos-product-meta">
                    <span className="pos-product-name">{p.name}</span>
                    <div className="pos-product-footer">
                      <span className="pos-product-price">{formatCurrency(p.discounted_price)}</span>
                      <span className="pos-product-stock">
                        {tUi('ui.pages.cashier.posTerminal.stock_968b5e6ede')}
                        {p.quantity}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="pos-sale-panel" aria-label={tUi('ui.pages.cashier.posTerminal.currentSale_53867b9445')}>
        <div className="pos-sale-header">
          <div className="pos-sale-title-row">
            <div className="pos-sale-title-group">
              <h2>{tUi('ui.pages.cashier.posTerminal.currentSale_53867b9445')}</h2>
              {lineCount > 0 && <span className="pos-line-count">{lineCount}</span>}
            </div>
            <input
              type="text"
              placeholder={tUi('ui.pages.cashier.posTerminal.customerNameOptional_e1f2a3b4c5')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pos-customer-input pos-customer-input--inline"
              aria-label={tUi('ui.pages.cashier.posTerminal.customerNameOptional_e1f2a3b4c5')}
            />
          </div>
        </div>

        <div className="pos-sale-body">
          {lines.length === 0 ? (
            <div className="pos-empty-cart">{tUi('ui.pages.cashier.posTerminal.tapProductsToAddLines_b80cc10ecb')}</div>
          ) : (
            <ul className="pos-lines">
              {lines.map((row) => (
                <li key={row.product_id} className="pos-line">
                  <div className="pos-line-top">
                    <div className="pos-line-info">
                      <span className="pos-line-name">{row.name}</span>
                      <span className="pos-line-unit">
                        {formatCurrency(row.unit)}
                        {tUi('ui.pages.cashier.posTerminal.each_6bbbc233de')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="pos-remove"
                      onClick={() => removeLine(row.product_id)}
                      aria-label={tUi('ui.pages.cashier.posTerminal.removeLine_de0acbfd5f')}
                    >
                      <FiX aria-hidden />
                    </button>
                  </div>
                  <div className="pos-line-bottom">
                    <div className="pos-qty-controls">
                      <button type="button" className="pos-qty-btn" onClick={() => adjustQty(row.product_id, -1)}>
                        −
                      </button>
                      <span className="pos-qty-display">{row.quantity}</span>
                      <button type="button" className="pos-qty-btn" onClick={() => adjustQty(row.product_id, 1)}>
                        +
                      </button>
                    </div>
                    <span className="pos-line-total">{formatCurrency(row.unit * row.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pos-sale-footer">
          {promotionSummary.promotion_discount > 0 && (
            <div className="pos-summary-row pos-promo-row">
              <span>{tUi('ui.pages.cashier.posTerminal.promotion_1c2c8ebd71')}</span>
              <span>-{formatCurrency(promotionSummary.promotion_discount)}</span>
            </div>
          )}

          <div className="pos-total-row">
            <span>{tUi('ui.pages.cashier.posTerminal.total_2fbdddbccd')}</span>
            <span>{formatCurrency(previewGrandTotal)}</span>
          </div>

          {showPaymentStep ? (
            <div className="pos-payment-methods" role="group" aria-label={tUi('ui.pages.cashier.posTerminal.payment_870a684c6e')}>
              <button
                type="button"
                className="pos-pay-method"
                onClick={() => handlePaymentSelect('cash')}
                disabled={submitting}
              >
                <FiDollarSign aria-hidden />
                {tUi('ui.pages.cashier.posTerminal.cash_3c02cb4939')}
              </button>
              <button
                type="button"
                className="pos-pay-method"
                onClick={() => handlePaymentSelect('card')}
                disabled={submitting}
              >
                <FiCreditCard aria-hidden />
                {tUi('ui.pages.cashier.posTerminal.card_b06f050926')}
              </button>
              <button
                type="button"
                className="pos-payment-back"
                onClick={() => setShowPaymentStep(false)}
                disabled={submitting}
              >
                {tUi('ui.context.confirmContext.cancel_c50fab1ce7')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pos-complete-btn"
              onClick={handleCompleteClick}
              disabled={submitting || lines.length === 0}
            >
              {tUi('ui.pages.cashier.posTerminal.completeSale_1b0458b1b4')}
            </button>
          )}
        </div>
      </aside>

      {showHistoryModal && (
        <div className="pos-modal-overlay" onClick={() => setShowHistoryModal(false)} role="presentation">
          <div
            className="pos-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="pos-history-title"
          >
            <div className="pos-modal-header">
              <h2 id="pos-history-title">{tUi('ui.pages.cashier.posTerminal.mySalesToday_69ede91d75')}</h2>
              <button type="button" className="pos-modal-close" onClick={() => setShowHistoryModal(false)} aria-label="Close">
                <FiX aria-hidden />
              </button>
            </div>

            <div className="pos-modal-body">
              {loadingToday ? (
                <div className="pos-loading">
                  <LoadingSpinner size="small" />
                </div>
              ) : todaySales.length === 0 ? (
                <p className="pos-muted">{tUi('ui.pages.cashier.posTerminal.noPosSalesYetToday_18d914dd0f')}</p>
              ) : (
                <div className="pos-table-wrap">
                  <table className="pos-today-table">
                    <thead>
                      <tr>
                        <th>{tUi('ui.pages.cashier.posTerminal.order_38c040619b')}</th>
                        <th>{tUi('ui.pages.cashier.posTerminal.time_4c0efc4233')}</th>
                        <th>{tUi('ui.pages.cashier.posTerminal.customer_d5e6f7a8b9')}</th>
                        <th>{tUi('ui.pages.cashier.posTerminal.total_2fbdddbccd')}</th>
                        <th>{tUi('ui.pages.cashier.posTerminal.method_91f619558e')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaySales.map((s) => (
                        <tr key={s.id}>
                          <td>#{s.id}</td>
                          <td>{new Date(s.created_at).toLocaleTimeString()}</td>
                          <td>{s.customer_name || tUi('ui.pages.cashier.posTerminal.walkIn_c0d1e2f3a4')}</td>
                          <td>{formatCurrency(s.total_amount)}</td>
                          <td className="pos-method-cell">{s.payment_method || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosTerminal;

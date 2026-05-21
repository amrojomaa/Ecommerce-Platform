import { tUi } from "../../i18n/uiText"; import React, { useState, useEffect, useCallback, useMemo } from 'react';
import http from '../../services/http';
import { POS_ENDPOINTS } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/cashier/PosTerminal.css';

const thumbUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${normalized}`;
};

const PosTerminal = () => {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [lines, setLines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [promotionSummary, setPromotionSummary] = useState({
    subtotal: 0,
    promotion_discount: 0,
    grand_total: 0,
    applied_promotion: null
  });

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const { data } = await http.get(POS_ENDPOINTS.PRODUCTS, {
        params: { q: search.trim(), category: category.trim() }
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

  useEffect(() => {
    const t = setTimeout(() => fetchCatalog(), 300);
    return () => clearTimeout(t);
  }, [fetchCatalog]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const addProduct = (p) => {
    if (p.quantity < 1) {
      toast.warn(tUi("ui.pages.cashier.posTerminal.outOfStock_1bf2a299b1"));
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

  const setQty = (productId, qty) => {
    const n = parseInt(qty, 10);
    if (Number.isNaN(n) || n < 1) return;
    setLines((prev) =>
      prev.map((row) => {
        if (row.product_id !== productId) return row;
        const capped = Math.min(n, row.maxStock);
        if (capped < n) toast.warn(`Quantity capped at ${row.maxStock} for ${row.name}`);
        return { ...row, quantity: capped };
      })
    );
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
        applied_promotion: null
      });
      return;
    }

    try {
      const { data } = await http.post(POS_ENDPOINTS.PROMOTION_PREVIEW, {
        items: currentLines.map(({ product_id, quantity }) => ({ product_id, quantity }))
      });
      setPromotionSummary({
        subtotal: Number(data?.subtotal || 0),
        promotion_discount: Number(data?.promotion_discount || 0),
        grand_total: Number(data?.grand_total || 0),
        applied_promotion: data?.applied_promotion || null
      });
    } catch {
      const fallbackSubtotal = currentLines.reduce((s, row) => s + row.unit * row.quantity, 0);
      setPromotionSummary({
        subtotal: fallbackSubtotal,
        promotion_discount: 0,
        grand_total: fallbackSubtotal,
        applied_promotion: null
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPromotionPreview(lines);
    }, 250);
    return () => clearTimeout(timer);
  }, [lines, refreshPromotionPreview]);

  const completeSale = async () => {
    if (lines.length === 0) {
      toast.warn(tUi("ui.pages.cashier.posTerminal.addItemsToTheSale_5c282636c6"));
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await http.post(POS_ENDPOINTS.SALE, {
        items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        payment_method: paymentMethod,
        customer_name: customerName || null
      });
      const saved = Number(data?.promotion_discount || 0);
      if (saved > 0) {
        toast.success(`Sale completed. Promotion saved ${formatCurrency(saved)}.`);
      } else {
        toast.success(tUi("ui.pages.cashier.posTerminal.saleCompleted_09843ea178"));
      }
      setLines([]);
      setCustomerName('');
      fetchToday();
      fetchCatalog();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = useMemo(() => {
    const s = new Set();
    catalog.forEach((p) => p.category_name && s.add(p.category_name));
    return [...s].sort();
  }, [catalog]);

  const previewSubtotal = promotionSummary.subtotal;
  const previewGrandTotal = promotionSummary.grand_total;

  return (
    <div className="pos-terminal">
      {/* LEFT PANEL */}
      <div className="pos-left-panel">
        <header className="pos-header">
          <div>
            <h1>{tUi("ui.pages.cashier.posTerminal.pointOfSale_dd320e4c12")}</h1>
            <p className="pos-sub">{tUi("ui.pages.cashier.posTerminal.searchProductsBuildTheCart_9022e9704c")}</p>
          </div>
          <button className="pos-history-btn" onClick={() => setShowHistoryModal(true)}>
            {tUi("ui.pages.cashier.posTerminal.mySalesToday_69ede91d75")}
          </button>
        </header>

        <div className="pos-filters">
          <input
            type="search"
            placeholder={tUi("ui.pages.cashier.posTerminal.searchByName_1a90c9550d")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pos-input"
            aria-label={tUi("ui.pages.cashier.posTerminal.searchProducts_ac70437f7f")} />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="pos-select"
            aria-label={tUi("ui.pages.cashier.posTerminal.filterCategory_93d0a059ec")}>

            <option value="">{tUi("ui.pages.cashier.posTerminal.allCategories_0c74d6af15")}</option>
            {categories.map((c) =>
              <option key={c} value={c}>
                {c}
              </option>
            )}
          </select>
        </div>

        {loadingCatalog ?
          <div className="pos-loading">
            <LoadingSpinner size="medium" />
          </div> :

          <div className="pos-product-grid">
            {catalog.map((p) =>
              <button
                key={p.id}
                type="button"
                className="pos-product-card"
                onClick={() => addProduct(p)}
                disabled={p.quantity < 1}>

                <div className="pos-product-thumb">
                  {p.images?.[0] ?
                    <img src={thumbUrl(p.images[0])} alt="" loading="lazy" /> :

                    <span className="pos-no-img">{tUi("ui.pages.cashier.posTerminal.noImage_bbc5075c44")}</span>
                  }
                </div>
                <div className="pos-product-meta">
                  <span className="pos-product-name">{p.name}</span>
                  <div className="pos-product-footer">
                    <span className="pos-product-price">{formatCurrency(p.discounted_price)}</span>
                    <span className="pos-product-stock">{tUi("ui.pages.cashier.posTerminal.stock_968b5e6ede")}{p.quantity}</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        }
      </div>

      {/* RIGHT PANEL */}
      <div className="pos-right-panel">
        <div className="pos-cart-header">
          <h2>{tUi("ui.pages.cashier.posTerminal.currentSale_53867b9445")}</h2>
          <div className="pos-customer-wrapper">
            <input
              type="text"
              placeholder="Customer Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pos-customer-input"
            />
          </div>
        </div>

        <div className="pos-cart-body">
          {lines.length === 0 ?
            <div className="pos-empty-cart">{tUi("ui.pages.cashier.posTerminal.tapProductsToAddLines_b80cc10ecb")}</div> :

            <ul className="pos-lines">
              {lines.map((row) =>
                <li key={row.product_id} className="pos-line">
                  <div className="pos-line-top">
                    <div className="pos-line-info">
                      <span className="pos-line-name">{row.name}</span>
                      <span className="pos-line-unit">{formatCurrency(row.unit)}{tUi("ui.pages.cashier.posTerminal.each_6bbbc233de")}</span>
                    </div>
                    <button type="button" className="pos-remove" onClick={() => removeLine(row.product_id)} aria-label={tUi("ui.pages.cashier.posTerminal.removeLine_de0acbfd5f")}>
                      ×
                    </button>
                  </div>
                  <div className="pos-line-bottom">
                    <div className="pos-qty-controls">
                      <button className="pos-qty-btn" onClick={() => adjustQty(row.product_id, -1)}>−</button>
                      <span className="pos-qty-display">{row.quantity}</span>
                      <button className="pos-qty-btn" onClick={() => adjustQty(row.product_id, 1)}>+</button>
                    </div>
                    <span className="pos-line-total">{formatCurrency(row.unit * row.quantity)}</span>
                  </div>
                </li>
              )}
            </ul>
          }
        </div>

        <div className="pos-cart-footer">
          <div className="pos-summary-row">
            <span>{tUi("ui.pages.cashier.posTerminal.subtotal_60eb12d249")}</span>
            <span>{formatCurrency(previewSubtotal)}</span>
          </div>

          {promotionSummary.promotion_discount > 0 &&
            <div className="pos-summary-row pos-promo-row">
              <span>{tUi("ui.pages.cashier.posTerminal.promotion_1c2c8ebd71")}</span>
              <span>-{formatCurrency(promotionSummary.promotion_discount)}</span>
            </div>
          }

          <div className="pos-total-row">
            <span>{tUi("ui.pages.cashier.posTerminal.total_2fbdddbccd")}</span>
            <span>{formatCurrency(previewGrandTotal)}</span>
          </div>

          <div className="pos-payment-methods">
            <div
              className={`pos-pay-method ${paymentMethod === 'cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
            >
              💵 {tUi("ui.pages.cashier.posTerminal.cash_3c02cb4939")}
            </div>
            <div
              className={`pos-pay-method ${paymentMethod === 'card' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('card')}
            >
              💳 {tUi("ui.pages.cashier.posTerminal.card_b06f050926")}
            </div>
          </div>

          <button type="button" className="pos-complete-btn" onClick={completeSale} disabled={submitting || lines.length === 0}>
            {submitting ? tUi("ui.pages.cashier.posTerminal.processing_94fb04c5f3") : tUi("ui.pages.cashier.posTerminal.completeSale_1b0458b1b4")}
          </button>
        </div>
      </div>

      {/* TODAY'S SALES MODAL */}
      {showHistoryModal && (
        <div className="pos-history-modal" onClick={() => setShowHistoryModal(false)}>
          <div className="pos-history-content" onClick={e => e.stopPropagation()}>
            <div className="pos-history-header">
              <h2>{tUi("ui.pages.cashier.posTerminal.mySalesToday_69ede91d75")}</h2>
              <button className="pos-close-history" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>

            <div className="pos-history-body">
              {loadingToday ?
                <LoadingSpinner size="small" /> :
                todaySales.length === 0 ?
                  <p className="pos-muted">{tUi("ui.pages.cashier.posTerminal.noPosSalesYetToday_18d914dd0f")}</p> :

                  <table className="pos-today-table">
                    <thead>
                      <tr>
                        <th>{tUi("ui.pages.cashier.posTerminal.order_38c040619b")}</th>
                        <th>{tUi("ui.pages.cashier.posTerminal.time_4c0efc4233")}</th>
                        <th>Customer</th>
                        <th>{tUi("ui.pages.cashier.posTerminal.total_2fbdddbccd")}</th>
                        <th>{tUi("ui.pages.cashier.posTerminal.method_91f619558e")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaySales.map((s) =>
                        <tr key={s.id}>
                          <td>#{s.id}</td>
                          <td>{new Date(s.created_at).toLocaleTimeString()}</td>
                          <td>{s.customer_name || 'Walk-in'}</td>
                          <td>{formatCurrency(s.total_amount)}</td>
                          <td style={{ textTransform: 'capitalize' }}>{s.payment_method || '—'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );

};

export default PosTerminal;

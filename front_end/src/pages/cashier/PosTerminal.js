import React, { useState, useEffect, useCallback, useMemo } from 'react';
import http from '../../services/http';
import { POS_ENDPOINTS } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { formatPrice } from '../../utils/helpers';
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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [lines, setLines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
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

  useEffect(() => {
    const t = setTimeout(() => fetchCatalog(), 300);
    return () => clearTimeout(t);
  }, [fetchCatalog]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const addProduct = (p) => {
    if (p.quantity < 1) {
      toast.warn('Out of stock');
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

  const completeSale = async () => {
    if (lines.length === 0) {
      toast.warn('Add items to the sale');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await http.post(POS_ENDPOINTS.SALE, {
        items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        payment_method: paymentMethod,
      });
      const saved = Number(data?.promotion_discount || 0);
      if (saved > 0) {
        toast.success(`Sale completed. Promotion saved ${formatPrice(saved)}.`);
      } else {
        toast.success('Sale completed');
      }
      setLines([]);
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
      <header className="pos-header">
        <h1>Point of sale</h1>
        <p className="pos-sub">Search products, build the cart, take payment, and complete the sale.</p>
      </header>

      <div className="pos-grid">
        <section className="pos-catalog">
          <div className="pos-filters">
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pos-input"
              aria-label="Search products"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="pos-select"
              aria-label="Filter category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {loadingCatalog ? (
            <div className="pos-loading">
              <LoadingSpinner size="medium" />
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
                      <span className="pos-no-img">No image</span>
                    )}
                  </div>
                  <div className="pos-product-meta">
                    <span className="pos-product-name">{p.name}</span>
                    <span className="pos-product-price">{formatPrice(p.discounted_price)}</span>
                    <span className="pos-product-stock">Stock: {p.quantity}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="pos-cart-panel">
          <h2>Current sale</h2>
          {lines.length === 0 ? (
            <p className="pos-empty-cart">Tap products to add lines.</p>
          ) : (
            <ul className="pos-lines">
              {lines.map((row) => (
                <li key={row.product_id} className="pos-line">
                  <div className="pos-line-info">
                    <span className="pos-line-name">{row.name}</span>
                    <span className="pos-line-unit">{formatPrice(row.unit)} each</span>
                  </div>
                  <div className="pos-line-actions">
                    <input
                      type="number"
                      min={1}
                      max={row.maxStock}
                      value={row.quantity}
                      onChange={(e) => setQty(row.product_id, e.target.value)}
                      className="pos-qty"
                      aria-label={`Quantity for ${row.name}`}
                    />
                    <span className="pos-line-total">{formatPrice(row.unit * row.quantity)}</span>
                    <button type="button" className="pos-remove" onClick={() => removeLine(row.product_id)} aria-label="Remove line">
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pos-total-row">
            <span>Subtotal</span>
            <strong>{formatPrice(previewSubtotal)}</strong>
          </div>

          {promotionSummary.promotion_discount > 0 && (
            <div className="pos-promo-row">
              <span>
                Promotion
                {promotionSummary.applied_promotion?.name
                  ? ` (${promotionSummary.applied_promotion.name})`
                  : ''}
              </span>
              <strong>-{formatPrice(promotionSummary.promotion_discount)}</strong>
            </div>
          )}

          <div className="pos-total-row pos-total-row-final">
            <span>Total</span>
            <strong>{formatPrice(previewGrandTotal)}</strong>
          </div>

          <div className="pos-payment">
            <span className="pos-payment-label">Payment</span>
            <div className="pos-payment-toggle">
              <label>
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                Cash
              </label>
              <label>
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                Card
              </label>
            </div>
          </div>

          <button type="button" className="pos-complete-btn" onClick={completeSale} disabled={submitting || lines.length === 0}>
            {submitting ? 'Processing…' : 'Complete sale'}
          </button>
        </section>
      </div>

      <section className="pos-today">
        <h2>My sales today</h2>
        {loadingToday ? (
          <LoadingSpinner size="small" />
        ) : todaySales.length === 0 ? (
          <p className="pos-muted">No POS sales yet today.</p>
        ) : (
          <table className="pos-today-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Time</th>
                <th>Total</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {todaySales.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td>{new Date(s.created_at).toLocaleTimeString()}</td>
                  <td>{formatPrice(s.total_amount)}</td>
                  <td>{s.payment_method || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default PosTerminal;

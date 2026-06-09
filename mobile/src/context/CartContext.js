import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { useTUi } from '../i18n/uiText';
import http from '../services/http';
import { CART_ENDPOINTS, buildUrl } from '../config/api';

export const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { isAuthenticated, user } = useContext(AuthContext);
  const tUi = useTUi();
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const quantityRequestSeq = useRef({});

  const applyCartPayload = useCallback((cartData) => {
    if (cartData?.items && Array.isArray(cartData.items)) {
      setCartItems(cartData.items);
      setSubtotal(cartData.subtotal || cartData.grand_total || 0);
      setPromotionDiscount(cartData.promotion_discount || 0);
      setAppliedPromotion(cartData.applied_promotion || null);
      setGrandTotal(cartData.grand_total || 0);
    } else {
      setCartItems([]);
      setSubtotal(0);
      setPromotionDiscount(0);
      setAppliedPromotion(null);
      setGrandTotal(0);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      applyCartPayload(null);
      return;
    }
    setLoading(true);
    try {
      const response = await http.get(CART_ENDPOINTS.GET);
      applyCartPayload(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        applyCartPayload(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyCartPayload, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      applyCartPayload(null);
    }
  }, [applyCartPayload, fetchCart, isAuthenticated, user?.id]);

  const addToCart = useCallback(
    async (productName, quantity = 1) => {
      if (!isAuthenticated) {
        return { success: false, error: tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0') };
      }
      setLoading(true);
      try {
        const response = await http.post(CART_ENDPOINTS.ADD, {
          product_name: productName,
          quantity,
        });
        await fetchCart();
        return { success: true, data: response.data };
      } catch (error) {
        return {
          success: false,
          error: error.response?.data?.detail || error.message || tUi('ui.pages.productDetails.failedToAddToCart_b4e8a1c2d7'),
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchCart, isAuthenticated, tUi]
  );

  const updateCartItem = useCallback(
    async (itemId, quantity) => {
      if (!isAuthenticated) return { success: false, error: tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0') };
      const requestSeq = (quantityRequestSeq.current[itemId] || 0) + 1;
      quantityRequestSeq.current[itemId] = requestSeq;

      const previousItems = [...cartItems];
      setCartItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
      );

      try {
        const response = await http.patch(buildUrl(CART_ENDPOINTS.UPDATE, { item_id: itemId }), {
          quantity,
        });
        if (quantityRequestSeq.current[itemId] !== requestSeq) {
          return { success: true };
        }
        applyCartPayload(response.data);
        return { success: true };
      } catch (error) {
        if (quantityRequestSeq.current[itemId] === requestSeq) {
          setCartItems(previousItems);
        }
        return {
          success: false,
          error: error.response?.data?.detail || error.message || tUi('ui.pages.cart.failedToUpdate_a3f8c2d1e8'),
        };
      }
    },
    [applyCartPayload, cartItems, isAuthenticated, tUi]
  );

  const removeCartItem = useCallback(
    async (itemId) => {
      if (!isAuthenticated) return { success: false, error: tUi('ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0') };
      try {
        await http.delete(buildUrl(CART_ENDPOINTS.DELETE_ITEM, { item_id: itemId }));
        await fetchCart();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error.response?.data?.detail || error.message || tUi('ui.pages.cart.failedToRemove_a3f8c2d1e9'),
        };
      }
    },
    [fetchCart, isAuthenticated, tUi]
  );

  const clearCart = useCallback(
    async (cartId) => {
      if (!cartId) return { success: false };
      try {
        await http.delete(buildUrl(CART_ENDPOINTS.CLEAR, { Cart_id: cartId }));
        await fetchCart();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [fetchCart]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      subtotal,
      promotionDiscount,
      appliedPromotion,
      grandTotal,
      loading,
      cartCount,
      fetchCart,
      addToCart,
      updateCartItem,
      removeCartItem,
      clearCart,
    }),
    [
      addToCart,
      appliedPromotion,
      cartCount,
      cartItems,
      clearCart,
      fetchCart,
      grandTotal,
      loading,
      promotionDiscount,
      removeCartItem,
      subtotal,
      updateCartItem,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

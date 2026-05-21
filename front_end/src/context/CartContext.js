import React, { createContext, useState, useEffect, useRef } from 'react';
import http from '../services/http';
import { CART_ENDPOINTS } from '../config/api';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // Check authentication status from localStorage
  const isAuthenticated = () => {
    return !!localStorage.getItem('token');
  };
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const quantityRequestSeq = useRef({});

  // Get current user ID from localStorage
  const getCurrentUserId = () => {
    try {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        return userData.id || userData.email; // Use ID or email as identifier
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return null;
  };

  // Watch for token and user changes
  useEffect(() => {
    const checkUserChange = () => {
      const token = localStorage.getItem('token');
      const userId = getCurrentUserId();
      
      // If no token, clear cart
      if (!token) {
        if (currentUserId !== null) {
          setCartItems([]);
          setSubtotal(0);
          setPromotionDiscount(0);
          setAppliedPromotion(null);
          setGrandTotal(0);
          setCurrentUserId(null);
          loadCartFromStorage();
        }
        return;
      }
      
      // If user changed, clear cart and fetch new user's cart
      if (userId && userId !== currentUserId) {
        setCartItems([]);
        setSubtotal(0);
        setPromotionDiscount(0);
        setAppliedPromotion(null);
        setGrandTotal(0);
        setCurrentUserId(userId);
        fetchCart();
        return;
      }
      
      // If same user but no cart loaded yet, fetch it
      if (token && userId && currentUserId === null && cartItems.length === 0) {
        setCurrentUserId(userId);
        fetchCart();
        return;
      }
    };

    // Check immediately
    checkUserChange();

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        checkUserChange();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Listen for custom auth events (for same-tab login/logout)
    const handleAuthChange = () => {
      checkUserChange();
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('focus', checkUserChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('focus', checkUserChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const loadCartFromStorage = () => {
    try {
      const savedCart = localStorage.getItem('guestCart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        setCartItems(cart.items || []);
        setSubtotal(cart.subtotal || cart.grandTotal || 0);
        setPromotionDiscount(cart.promotionDiscount || 0);
        setAppliedPromotion(cart.appliedPromotion || null);
        setGrandTotal(cart.grandTotal || 0);
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
  };

  const fetchCart = async () => {
    if (!isAuthenticated()) return;
    
    setLoading(true);
    try { 
      const response = await http.get(CART_ENDPOINTS.GET);
      const cartData = response.data;
      
      if (cartData.items && Array.isArray(cartData.items)) {
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
    } catch (error) {
      // If cart not found, initialize empty cart
      if (error.status === 404) {
        setCartItems([]);
        setSubtotal(0);
        setPromotionDiscount(0);
        setAppliedPromotion(null);
        setGrandTotal(0);
      } else {
        console.error('Error fetching cart:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getItemUnitPrice = (item) => {
    return Number(
      item.product?.discounted_price ??
      item.product?.price ??
      0
    );
  };

  const updateTotalsFromItems = (items, totals = {}) => {
    const nextSubtotal = Number.isFinite(Number(totals.subtotal)) ?
      Number(totals.subtotal) :
      items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const nextPromotionDiscount = Number.isFinite(Number(totals.promotion_discount)) ?
      Number(totals.promotion_discount) :
      promotionDiscount;
    const nextGrandTotal = Number.isFinite(Number(totals.grand_total)) ?
      Number(totals.grand_total) :
      Math.max(nextSubtotal - nextPromotionDiscount, 0);

    setSubtotal(nextSubtotal);
    setPromotionDiscount(nextPromotionDiscount);
    if (Object.prototype.hasOwnProperty.call(totals, 'applied_promotion')) {
      setAppliedPromotion(totals.applied_promotion);
    }
    setGrandTotal(nextGrandTotal);
  };

  const addToCart = async (productName, quantity = 1) => {
    if (!isAuthenticated()) {
      // Handle guest cart (localStorage)
      // For guest cart, we'd need product data - simplified for now
      return { success: false, error: 'Please login to add items to cart' };
    }

    setLoading(true);
    try {
      const response = await http.post(CART_ENDPOINTS.ADD, {
        product_name: productName,
        quantity: quantity,
      });
      
      await fetchCart(); // Refresh cart
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to add item to cart',
      };
    } finally {
      setLoading(false);
    }
  };

  const updateCartItem = async (itemId, quantity) => {
    if (!isAuthenticated()) return { success: false, error: 'Please login' };

    const requestSeq = (quantityRequestSeq.current[itemId] || 0) + 1;
    quantityRequestSeq.current[itemId] = requestSeq;

    // Optimistically update local state first for instant feedback
    const previousItems = [...cartItems];
    setCartItems(prevItems => {
      const updated = prevItems.map(item => {
        if (item.id === itemId) {
          const newTotal = getItemUnitPrice(item) * quantity;
          return { ...item, quantity: quantity, total: newTotal };
        }
        return item;
      });

      updateTotalsFromItems(updated);
      return updated;
    });

    // Don't show loading for quick updates - makes it feel instant
    try {
      const response = await http.put(CART_ENDPOINTS.UPDATE.replace('{item_id}', itemId), {
        quantity: quantity,
      });
      
      // Update with server response to ensure accuracy
      const updatedData = response.data;
      if (quantityRequestSeq.current[itemId] !== requestSeq) {
        return { success: true };
      }

      setCartItems(prevItems => {
        const updated = prevItems.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              quantity: updatedData.quantity,
              total: updatedData.total,
              product: {
                ...item.product,
                ...updatedData.product
              }
            };
          }
          return item;
        });

        updateTotalsFromItems(updated, {
          subtotal: updatedData.subtotal,
          promotion_discount: updatedData.promotion_discount,
          applied_promotion: updatedData.applied_promotion,
          grand_total: updatedData.grand_total
        });
        return updated;
      });
      return { success: true };
    } catch (error) {
      // On error, revert only if this is still the latest request for the item.
      if (quantityRequestSeq.current[itemId] === requestSeq) {
        setCartItems(previousItems);
        updateTotalsFromItems(previousItems);
      }
      return {
        success: false,
        error: error.message || 'Failed to update cart item',
      };
    }
  };

  const removeCartItem = async (itemId) => {
    if (!isAuthenticated()) return { success: false, error: 'Please login' };

    // Optimistically remove from local state first for instant feedback
    const previousItems = [...cartItems];
    setCartItems(prevItems => {
      const updated = prevItems.filter(item => item.id !== itemId);
      // Recalculate grand total from remaining items
      const newGrandTotal = updated.reduce((sum, item) => sum + (item.total || 0), 0);
      setGrandTotal(newGrandTotal);
      return updated;
    });

    // Don't show loading for quick deletes - makes it feel instant
    try {
      await http.delete(CART_ENDPOINTS.DELETE_ITEM.replace('{item_id}', itemId));
      await fetchCart();
      return { success: true };
    } catch (error) {
      // On error, revert to previous state and refetch to sync with server
      setCartItems(previousItems);
      await fetchCart();
      return {
        success: false,
        error: error.message || 'Failed to remove item from cart',
      };
    }
  };

  const clearCart = async (cartId) => {
    if (!isAuthenticated()) return { success: false, error: 'Please login' };

    setLoading(true);
    try {
      await http.delete(CART_ENDPOINTS.CLEAR.replace('{Cart_id}', cartId));
      await fetchCart();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to clear cart',
      };
    } finally {
      setLoading(false);
    }
  };

  const getCartItemCount = () => {
    return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

  const value = {
    cartItems,
    subtotal,
    promotionDiscount,
    appliedPromotion,
    grandTotal,
    loading,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    fetchCart,
    getCartItemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

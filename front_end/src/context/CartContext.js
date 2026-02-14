import React, { createContext, useState, useEffect } from 'react';
import http from '../services/http';
import { CART_ENDPOINTS } from '../config/api';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // Check authentication status from localStorage
  const isAuthenticated = () => {
    return !!localStorage.getItem('token');
  };
  const [cartItems, setCartItems] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load cart from API when authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      fetchCart();
    } else {
      // Load from localStorage if not authenticated (guest cart)
      loadCartFromStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCartFromStorage = () => {
    try {
      const savedCart = localStorage.getItem('guestCart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        setCartItems(cart.items || []);
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
        setGrandTotal(cartData.grand_total || 0);
      } else {
        setCartItems([]);
        setGrandTotal(0);
      }
    } catch (error) {
      // If cart not found, initialize empty cart
      if (error.status === 404) {
        setCartItems([]);
        setGrandTotal(0);
      } else {
        console.error('Error fetching cart:', error);
      }
    } finally {
      setLoading(false);
    }
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

    setLoading(true);
    try {
      await http.put(CART_ENDPOINTS.UPDATE.replace('{item_id}', itemId), {
        quantity: quantity,
      });
      
      await fetchCart();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update cart item',
      };
    } finally {
      setLoading(false);
    }
  };

  const removeCartItem = async (itemId) => {
    if (!isAuthenticated()) return { success: false, error: 'Please login' };

    setLoading(true);
    try {
      await http.delete(CART_ENDPOINTS.DELETE_ITEM.replace('{item_id}', itemId));
      await fetchCart();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove item from cart',
      };
    } finally {
      setLoading(false);
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

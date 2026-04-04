import React, { createContext, useState, useEffect } from 'react';
import http from '../services/http';
import { WISHLIST_ENDPOINTS } from '../config/api';

export const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Check authentication status from localStorage
  const isAuthenticated = () => {
    return !!localStorage.getItem('token');
  };

  // Get current user ID from localStorage
  const getCurrentUserId = () => {
    try {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        return userData.id || userData.email; // Use ID or email as identifier
      }
    } catch (error) {
      console.error('Error parsing user data');
    }
    return null;
  };

  // Watch for token and user changes
  useEffect(() => {
    const checkUserChange = () => {
      const token = localStorage.getItem('token');
      const userId = getCurrentUserId();
      
      // If no token, clear wishlist
      if (!token) {
        if (currentUserId !== null) {
          setWishlistItems([]);
          setCurrentUserId(null);
        }
        return;
      }
      
      // If user changed, clear wishlist and fetch new user's wishlist
      if (userId && userId !== currentUserId) {
        setWishlistItems([]);
        setCurrentUserId(userId);
        fetchWishlist();
        return;
      }
      
      // If same user but no wishlist loaded yet, fetch it
      if (token && userId && currentUserId === null && wishlistItems.length === 0) {
        setCurrentUserId(userId);
        fetchWishlist();
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

    // Periodic sync; auth-change/storage events handle fast-path updates.
    const interval = setInterval(checkUserChange, 30000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const fetchWishlist = async () => {
    if (!isAuthenticated()) return;
    
    setLoading(true);
    try {
      const response = await http.get(WISHLIST_ENDPOINTS.GET);
      const wishlistData = response.data;
      
      if (wishlistData.items && Array.isArray(wishlistData.items)) {
        // Transform API response to match frontend format
        const transformedItems = wishlistData.items.map(item => ({
          id: item.id,
          name: item.product.name,
          price: item.product.price,
          original_price: item.product.original_price ?? item.product.price,
          discounted_price: item.product.discounted_price ?? item.product.price,
          discount_enabled: Boolean(item.product.discount_enabled),
          has_discount: Boolean(item.product.has_discount) || (item.product.discounted_price ?? item.product.price) < (item.product.original_price ?? item.product.price),
          category_name: item.product.category_name || '',
          images: item.product.images || [],
          description: item.product.description || '',
          product: item.product
        }));
        setWishlistItems(transformedItems);
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      // If wishlist not found, initialize empty wishlist
      if (error.status === 404) {
        setWishlistItems([]);
      } else {
        console.error('Error fetching wishlist');
      }
    } finally {
      setLoading(false);
    }
  };

  const addToWishlist = async (product) => {
    if (!isAuthenticated()) {
      return { success: false, error: 'Please login to add items to wishlist' };
    }

    // Optimistically add to local state first
    const productData = {
      id: Date.now(), // Temporary ID
      name: product.name,
      price: product.price,
      original_price: product.price,
      discounted_price: product.discounted_price ?? product.price,
      discount_enabled: Boolean(product.discount_enabled),
      has_discount: Boolean(product.discount_enabled) && (product.discounted_price ?? product.price) < product.price,
      category_name: product.category_name,
      images: product.images || [],
      description: product.description,
      product: {
        name: product.name,
        price: product.discounted_price ?? product.price,
        original_price: product.price,
        discounted_price: product.discounted_price ?? product.price,
        discount_enabled: Boolean(product.discount_enabled),
        has_discount: Boolean(product.discount_enabled) && (product.discounted_price ?? product.price) < product.price,
        images: product.images || []
      }
    };

    // Check if product already exists in wishlist
    const exists = wishlistItems.some((item) => item.name === product.name);
    if (exists) {
      return { success: false, error: 'Product already in wishlist' };
    }

    setWishlistItems(prevItems => [...prevItems, productData]);

    setLoading(true);
    try {
      const response = await http.post(WISHLIST_ENDPOINTS.ADD, {
        product_name: product.name,
      });
      
      // Update with server response
      const newItem = {
        id: response.data.id,
        name: response.data.product.name,
        price: response.data.product.price,
        original_price: response.data.product.original_price ?? response.data.product.price,
        discounted_price: response.data.product.discounted_price ?? response.data.product.price,
        discount_enabled: Boolean(response.data.product.discount_enabled),
        has_discount: Boolean(response.data.product.has_discount) || (response.data.product.discounted_price ?? response.data.product.price) < (response.data.product.original_price ?? response.data.product.price),
        images: response.data.product.images || [],
        product: response.data.product
      };
      
      setWishlistItems(prevItems => 
        prevItems.map(item => 
          item.name === product.name ? newItem : item
        )
      );
      
      return { success: true };
    } catch (error) {
      // On error, revert optimistic update
      setWishlistItems(prevItems => 
        prevItems.filter(item => item.name !== product.name)
      );
      return {
        success: false,
        error: error.message || 'Failed to add item to wishlist',
      };
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productName) => {
    if (!isAuthenticated()) {
      return { success: false, error: 'Please login' };
    }

    // Find the item to get its ID
    const itemToRemove = wishlistItems.find(item => item.name === productName);
    if (!itemToRemove) {
      return { success: false, error: 'Item not found in wishlist' };
    }

    // Optimistically remove from local state
    const previousItems = [...wishlistItems];
    setWishlistItems(prevItems => prevItems.filter(item => item.name !== productName));

    setLoading(true);
    try {
      await http.delete(WISHLIST_ENDPOINTS.DELETE_ITEM.replace('{item_id}', itemToRemove.id));
      return { success: true };
    } catch (error) {
      // On error, revert optimistic update
      setWishlistItems(previousItems);
      return {
        success: false,
        error: error.message || 'Failed to remove item from wishlist',
      };
    } finally {
      setLoading(false);
    }
  };

  const isInWishlist = (productName) => {
    return wishlistItems.some((item) => item.name === productName);
  };

  const getWishlistItemCount = () => {
    return wishlistItems.length;
  };

  const clearWishlist = async () => {
    if (!isAuthenticated()) {
      setWishlistItems([]);
      return { success: true };
    }

    const previousItems = [...wishlistItems];
    setWishlistItems([]);
    setLoading(true);
    try {
      await http.delete(WISHLIST_ENDPOINTS.CLEAR);
      return { success: true };
    } catch (error) {
      setWishlistItems(previousItems);
      return {
        success: false,
        error: error.message || 'Failed to clear wishlist',
      };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    wishlistItems,
    loading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    getWishlistItemCount,
    clearWishlist,
    fetchWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

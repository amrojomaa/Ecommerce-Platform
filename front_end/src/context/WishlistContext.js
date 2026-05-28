import React, { createContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import http from '../services/http';
import { WISHLIST_ENDPOINTS, PRODUCT_ENDPOINTS } from '../config/api';
import { trackRecommendationEvent } from '../services/recommendations';

export const WishlistContext = createContext();

const mapWishlistItem = (item) => ({
  id: item.id,
  product_id: item.product_id ?? item.product?.id ?? null,
  name: item.product.name,
  name_ar: item.product.name_ar || '',
  name_fr: item.product.name_fr || '',
  price: item.product.price,
  original_price: item.product.original_price ?? item.product.price,
  discounted_price: item.product.discounted_price ?? item.product.price,
  discount_enabled: Boolean(item.product.discount_enabled),
  has_discount:
    Boolean(item.product.has_discount) ||
    (item.product.discounted_price ?? item.product.price) <
      (item.product.original_price ?? item.product.price),
  category_name: item.product.category_name || '',
  category_name_ar: item.product.category_name_ar || '',
  category_name_fr: item.product.category_name_fr || '',
  images: item.product.images || [],
  description: item.product.description || '',
  description_ar: item.product.description_ar || '',
  description_fr: item.product.description_fr || '',
  average_rating: item.product.average_rating ?? 0,
  total_ratings: item.product.total_ratings ?? 0,
  product: item.product,
});

const enrichWishlistItems = async (items) => {
  if (!items.some((item) => !item.product_id)) {
    return items;
  }

  try {
    const response = await http.get(PRODUCT_ENDPOINTS.ALL);
    const catalogByName = new Map((response.data || []).map((product) => [product.name, product]));

    return items.map((item) => {
      if (item.product_id) {
        return item;
      }

      const match = catalogByName.get(item.name);
      if (!match) {
        return item;
      }

      return {
        ...item,
        product_id: match.id,
        average_rating: Number.isFinite(Number(item.average_rating))
          ? item.average_rating
          : match.average_rating ?? 0,
        total_ratings: Number.isFinite(Number(item.total_ratings))
          ? item.total_ratings
          : match.total_ratings ?? 0,
        product: {
          ...item.product,
          id: match.id,
          average_rating: item.product?.average_rating ?? match.average_rating ?? 0,
          total_ratings: item.product?.total_ratings ?? match.total_ratings ?? 0,
        },
      };
    });
  } catch (error) {
    console.error('Error enriching wishlist items:', error);
    return items;
  }
};

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
      console.error('Error parsing user data:', error);
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
    window.addEventListener('focus', checkUserChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('focus', checkUserChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated()) return;
    
    setLoading(true);
    try {
      const response = await http.get(WISHLIST_ENDPOINTS.GET);
      const wishlistData = response.data;
      
      if (wishlistData.items && Array.isArray(wishlistData.items)) {
        const transformedItems = await enrichWishlistItems(
          wishlistData.items.map(mapWishlistItem)
        );
        setWishlistItems(transformedItems);
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      // If wishlist not found, initialize empty wishlist
      if (error.status === 404) {
        setWishlistItems([]);
      } else {
        console.error('Error fetching wishlist:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const addToWishlist = async (product) => {
    if (!isAuthenticated()) {
      return { success: false, error: 'Please login to add items to wishlist' };
    }

    // Optimistically add to local state first
    const productData = {
      id: Date.now(), // Temporary wishlist item ID
      product_id: product.id,
      name: product.name,
      name_ar: product.name_ar || '',
      name_fr: product.name_fr || '',
      price: product.price,
      original_price: product.price,
      discounted_price: product.discounted_price ?? product.price,
      discount_enabled: Boolean(product.discount_enabled),
      has_discount: Boolean(product.discount_enabled) && (product.discounted_price ?? product.price) < product.price,
      category_name: product.category_name,
      category_name_ar: product.category_name_ar || '',
      category_name_fr: product.category_name_fr || '',
      images: product.images || [],
      description: product.description,
      description_ar: product.description_ar || '',
      description_fr: product.description_fr || '',
      average_rating: product.average_rating ?? 0,
      total_ratings: product.total_ratings ?? 0,
      product: {
        id: product.id,
        name: product.name,
        name_ar: product.name_ar || '',
        name_fr: product.name_fr || '',
        price: product.discounted_price ?? product.price,
        original_price: product.price,
        discounted_price: product.discounted_price ?? product.price,
        discount_enabled: Boolean(product.discount_enabled),
        has_discount: Boolean(product.discount_enabled) && (product.discounted_price ?? product.price) < product.price,
        category_name: product.category_name || '',
        category_name_ar: product.category_name_ar || '',
        category_name_fr: product.category_name_fr || '',
        description: product.description || '',
        description_ar: product.description_ar || '',
        description_fr: product.description_fr || '',
        images: product.images || [],
        average_rating: product.average_rating ?? 0,
        total_ratings: product.total_ratings ?? 0,
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
      const newItem = mapWishlistItem(response.data);
      
      setWishlistItems(prevItems => 
        prevItems.map(item => 
          item.name === product.name ? newItem : item
        )
      );
      
      const pid = response.data?.product?.id;
      if (pid) {
        trackRecommendationEvent({ event_type: 'wishlist', product_id: pid });
      }
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

    let itemToRemove;
    let previousItems;

    flushSync(() => {
      setWishlistItems((prevItems) => {
        const found = prevItems.find((item) => item.name === productName);
        if (!found) {
          return prevItems;
        }
        itemToRemove = found;
        previousItems = [...prevItems];
        return prevItems.filter((item) => item.name !== productName);
      });
    });

    if (!itemToRemove) {
      return { success: false, error: 'Item not found in wishlist' };
    }

    const itemId = Number(itemToRemove.id);
    if (!Number.isFinite(itemId)) {
      setWishlistItems(previousItems);
      return {
        success: false,
        error: 'Invalid wishlist item id — refresh and try again',
      };
    }

    setLoading(true);
    try {
      await http.delete(WISHLIST_ENDPOINTS.DELETE_ITEM.replace('{item_id}', itemId));
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

  const clearWishlist = () => {
    setWishlistItems([]);
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

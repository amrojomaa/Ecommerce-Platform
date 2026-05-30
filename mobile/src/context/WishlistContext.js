import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import http from '../services/http';
import { PRODUCT_ENDPOINTS, WISHLIST_ENDPOINTS, buildUrl } from '../config/api';

export const WishlistContext = createContext(null);

const mapWishlistItem = (item) => ({
  id: item.id,
  product_id: item.product_id ?? item.product?.id ?? null,
  name: item.product?.name,
  price: item.product?.price,
  discounted_price: item.product?.discounted_price ?? item.product?.price,
  discount_enabled: Boolean(item.product?.discount_enabled),
  category_name: item.product?.category_name || '',
  images: item.product?.images || [],
  average_rating: item.product?.average_rating ?? 0,
  total_ratings: item.product?.total_ratings ?? 0,
  product: item.product,
});

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistItems([]);
      return;
    }
    setLoading(true);
    try {
      const response = await http.get(WISHLIST_ENDPOINTS.GET);
      const items = response.data?.items;
      setWishlistItems(Array.isArray(items) ? items.map(mapWishlistItem) : []);
    } catch (error) {
      if (error.response?.status === 404) {
        setWishlistItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist, user?.id]);

  const addToWishlist = useCallback(
    async (product) => {
      if (!isAuthenticated) {
        return { success: false, error: 'Please login to add items to wishlist' };
      }
      if (wishlistItems.some((item) => item.name === product.name)) {
        return { success: false, error: 'Product already in wishlist' };
      }
      setLoading(true);
      try {
        const response = await http.post(WISHLIST_ENDPOINTS.ADD, {
          product_name: product.name,
        });
        const newItem = mapWishlistItem(response.data);
        setWishlistItems((prev) => [...prev.filter((i) => i.name !== product.name), newItem]);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error.response?.data?.detail || error.message || 'Failed to add to wishlist',
        };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, wishlistItems]
  );

  const removeFromWishlist = useCallback(
    async (productName) => {
      if (!isAuthenticated) return { success: false, error: 'Please login' };
      const item = wishlistItems.find((entry) => entry.name === productName);
      if (!item?.id) return { success: false, error: 'Item not found' };
      const previous = [...wishlistItems];
      setWishlistItems((prev) => prev.filter((entry) => entry.name !== productName));
      setLoading(true);
      try {
        await http.delete(buildUrl(WISHLIST_ENDPOINTS.DELETE_ITEM, { item_id: item.id }));
        return { success: true };
      } catch (error) {
        setWishlistItems(previous);
        return {
          success: false,
          error: error.response?.data?.detail || error.message || 'Failed to remove from wishlist',
        };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, wishlistItems]
  );

  const isInWishlist = useCallback(
    (productName) => wishlistItems.some((item) => item.name === productName),
    [wishlistItems]
  );

  const value = useMemo(
    () => ({
      wishlistItems,
      loading,
      wishlistCount: wishlistItems.length,
      fetchWishlist,
      addToWishlist,
      removeFromWishlist,
      isInWishlist,
    }),
    [addToWishlist, fetchWishlist, isInWishlist, loading, removeFromWishlist, wishlistItems]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { useTUi } from '../i18n/uiText';
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
  const tUi = useTUi();
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
        return { success: false, error: tUi('ui.pages.wishlist.pleaseLoginToAdd_b4e8c2d3f6') };
      }
      if (wishlistItems.some((item) => item.name === product.name)) {
        return { success: false, error: tUi('ui.pages.wishlist.alreadyInWishlist_b4e8c2d3f7') };
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
          error: error.response?.data?.detail || error.message || tUi('ui.pages.wishlist.failedToAdd_b4e8c2d3f8'),
        };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, tUi, wishlistItems]
  );

  const removeFromWishlist = useCallback(
    async (productName) => {
      if (!isAuthenticated) return { success: false, error: tUi('ui.pages.wishlist.pleaseLoginToAdd_b4e8c2d3f6') };
      const item = wishlistItems.find((entry) => entry.name === productName);
      if (!item?.id) return { success: false, error: tUi('ui.mobile.common.noResults') };
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
          error: error.response?.data?.detail || error.message || tUi('ui.pages.wishlist.removeFromWishlist_a74e7f0fd2'),
        };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, tUi, wishlistItems]
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

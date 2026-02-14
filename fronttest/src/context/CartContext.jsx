import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch cart from API when authenticated
  const fetchCart = async () => {
    if (!isAuthenticated) {
      setCartItems([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/showmecart');
      const cartData = response.data;
      
      // Handle case where API returns empty array or object with items
      if (Array.isArray(cartData) && cartData.length === 0) {
        setCartItems([]);
        setGrandTotal(0);
        setCartId(null);
        return;
      }
      
      if (cartData.items && cartData.items.length > 0) {
        // Transform API response to match frontend structure
        const items = cartData.items.map((item) => ({
          id: item.id, // cart item id
          cart_id: item.cart_id,
          product_id: item.product_id || item.product?.id,
          name: item.product?.name || item.product_name,
          description: item.product?.description || '',
          price: item.product?.price || item.price,
          image: item.product?.image || null,
          quantity: item.quantity,
          total: item.total || (item.product?.price * item.quantity),
          product: item.product, // Keep full product object if available
        }));
        
        setCartItems(items);
        setGrandTotal(cartData.grand_total || 0);
        
        // Extract cart_id from first item if available
        if (items.length > 0 && items[0].cart_id) {
          setCartId(items[0].cart_id);
        }
      } else {
        setCartItems([]);
        setGrandTotal(0);
        setCartId(null);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch cart:', error);
      }
      setCartItems([]);
      setGrandTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      setCartItems([]);
      setGrandTotal(0);
      setCartId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const addToCart = async (product, quantity = 1) => {
    if (!isAuthenticated) {
      // Fallback to localStorage for unauthenticated users
      setCartItems((prevItems) => {
        const existingItem = prevItems.find((item) => item.product_id === product.id);
        
        if (existingItem) {
          return prevItems.map((item) =>
            item.product_id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        
        return [...prevItems, { ...product, product_id: product.id, quantity }];
      });
      return;
    }

    try {
      await api.post('/addtocart', {
        product_name: product.name,
        quantity: quantity,
      });
      // Refresh cart after adding
      await fetchCart();
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to add item to cart');
    }
  };

  const removeFromCart = async (itemId) => {
    if (!isAuthenticated) {
      // Fallback to localStorage for unauthenticated users
      setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      return;
    }

    try {
      await api.delete(`/deletecart/${itemId}`);
      // Refresh cart after deletion
      await fetchCart();
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to remove item from cart');
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    if (!isAuthenticated) {
      // Fallback to localStorage for unauthenticated users
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        )
      );
      return;
    }

    try {
      await api.put(`/updatecart/${itemId}`, {
        quantity: quantity,
      });
      // Refresh cart after update
      await fetchCart();
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update cart item');
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated) {
      setCartItems([]);
      setGrandTotal(0);
      setCartId(null);
      return;
    }

    // Get cart_id from first item or stored cartId
    const currentCartId = cartItems.length > 0 ? cartItems[0].cart_id : cartId;
    
    if (!currentCartId) {
      setCartItems([]);
      setGrandTotal(0);
      setCartId(null);
      return;
    }

    try {
      await api.delete(`/clearcart/${currentCartId}`);
      setCartItems([]);
      setGrandTotal(0);
      setCartId(null);
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to clear cart');
    }
  };

  const getCartTotal = () => {
    if (grandTotal > 0) {
      return grandTotal;
    }
    // Fallback calculation
    return cartItems.reduce((total, item) => {
      const itemTotal = item.total || (item.price * item.quantity);
      return total + itemTotal;
    }, 0);
  };

  const getCartItemsCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    loading,
    refreshCart: fetchCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

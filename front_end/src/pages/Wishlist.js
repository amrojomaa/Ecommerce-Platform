import { tUi } from "../i18n/uiText";import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useWishlist } from '../hooks/useWishlist';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { FaHeart, FaTrash } from 'react-icons/fa';
import API_BASE_URL from '../config/api';
import '../styles/pages/Wishlist.css';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, loading, fetchWishlist } =
  useWishlist();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  const handleRemove = async (productName) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.wishlist.removeFromWishlist_a74e7f0fd2"),
      message: `Remove ${productName} from wishlist?`,
      confirmText: tUi("ui.pages.wishlist.remove_b2597b3f3e"),
      cancelText: tUi("ui.pages.wishlist.cancel_32e949f897")
    });
    if (confirmed) {
      await removeFromWishlist(productName);
    }
  };

  const getProductImage = (product) => {
    if (product.images && product.images.length > 0) {
      return `${API_BASE_URL}/${product.images[0]}`;
    }
    return `${API_BASE_URL}/images/placeholder.jpg`;
  };

  const handleDeleteAll = async () => {
    if (wishlistItems.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: tUi("ui.pages.wishlist.deleteAllItems_b7b329cb96"),
      message: tUi("ui.pages.wishlist.areYouSureYouWant_32be9b96fc"),
      confirmText: tUi("ui.pages.wishlist.deleteAll_6e9fe227ec"),
      cancelText: tUi("ui.pages.wishlist.cancel_32e949f897")
    });
    if (!confirmed) {
      return;
    }

    const productNames = wishlistItems.map((item) => item.name);
    for (const productName of productNames) {
      const result = await removeFromWishlist(productName);
      if (!result.success) {
        await fetchWishlist();
        toast.error(result.error || 'Some wishlist items could not be deleted. Please try again.');
        return;
      }
    }

    await fetchWishlist();
    toast.success(tUi("ui.pages.wishlist.allWishlistItemsDeleted_de016c0740"));
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-container">
          <h1>{tUi("ui.pages.wishlist.myWishlist_8547aa7391")}</h1>
          <div className="empty-wishlist">
            <FaHeart className="empty-icon" />
            <h2>{tUi("ui.pages.wishlist.yourWishlistIsEmpty_25ded470c1")}</h2>
            <p>{tUi("ui.pages.wishlist.startAddingProductsYouLove_1dae7ca234")}</p>
            <Link to="/products" className="browse-products-btn">{tUi("ui.pages.wishlist.browseProducts_69993227ec")}

            </Link>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="wishlist-page">
      <div className="wishlist-container">
        <div className="wishlist-header">
          <h1>{tUi("ui.pages.wishlist.myWishlist_b191477b96")}{wishlistItems.length})</h1>
          <button
            type="button"
            className="delete-all-btn"
            onClick={handleDeleteAll}
            disabled={loading || wishlistItems.length === 0}>{tUi("ui.pages.wishlist.deleteAll_6e9fe227ec")}


          </button>
        </div>
        <div className="wishlist-grid">
          {wishlistItems.map((product, index) =>
          <motion.div
            key={product.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="wishlist-item">
            
              <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="wishlist-item-link">
              
                <div className="wishlist-item-image">
                  <img
                  src={getProductImage(product)}
                  alt={product.name}
                  onError={(e) => {
                    e.target.src = `${API_BASE_URL}/images/placeholder.jpg`;
                  }} />
                
                </div>
                <div className="wishlist-item-info">
                  <h3>{product.name}</h3>
                  <p className="wishlist-item-category">{product.category_name}</p>
                  {(() => {
                  const originalPrice = Number(
                    product.original_price ?? product.price ?? 0
                  );
                  const discountedPrice = Number(
                    product.discounted_price ?? product.price ?? 0
                  );
                  const hasDiscount =
                  Boolean(product.has_discount) ||
                  discountedPrice < originalPrice;
                  return hasDiscount ?
                  <div className="wishlist-price-block">
                        <p className="wishlist-item-price-old">
                          {formatCurrency(originalPrice)}
                        </p>
                        <p className="wishlist-item-price-new">
                          {formatCurrency(discountedPrice)}
                        </p>
                      </div> :

                  <p className="wishlist-item-price">
                        {formatCurrency(product.price)}
                      </p>;

                })()}
                </div>
              </Link>
              <button
              className="remove-wishlist-btn"
              onClick={(e) => {
                e.preventDefault();
                handleRemove(product.name);
              }}
              title={tUi("ui.pages.wishlist.removeFromWishlist_a74e7f0fd2")}>
              
                <FaTrash />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>);

};

export default Wishlist;

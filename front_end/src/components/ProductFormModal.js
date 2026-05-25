import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { tUi } from '../i18n/uiText';
import http from '../services/http';
import API_BASE_URL, { IMAGE_ENDPOINTS, PRODUCT_ENDPOINTS, buildUrl } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import '../styles/pages/admin/AdminProductsModal.css';

const EMPTY_FORM = {
  name: '',
  name_ar: '',
  name_fr: '',
  description: '',
  description_ar: '',
  description_fr: '',
  price: '',
  quantity: '',
  category_name: '',
  discount_enabled: false,
  discount_type: 'percentage',
  discount_value: '',
};

const ProductFormModal = ({
  isOpen,
  onClose,
  onSaved,
  editingProduct,
  categories,
  setCategories,
  panelKicker,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetInternalState = useCallback(() => {
    setFormData(EMPTY_FORM);
    setImages([]);
    setUploading(false);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetInternalState();
      return;
    }

    if (editingProduct) {
      if (
        editingProduct.category_name &&
        setCategories &&
        !categories.some((category) => category.name === editingProduct.category_name)
      ) {
        setCategories((prev) => [
          ...prev,
          {
            id: `current-${editingProduct.category_name}`,
            name: editingProduct.category_name,
            description: '',
          },
        ]);
      }

      setFormData({
        name: editingProduct.name || '',
        name_ar: editingProduct.name_ar || '',
        name_fr: editingProduct.name_fr || '',
        description: editingProduct.description || '',
        description_ar: editingProduct.description_ar || '',
        description_fr: editingProduct.description_fr || '',
        price: editingProduct.price ?? '',
        quantity: editingProduct.quantity ?? '',
        category_name: editingProduct.category_name || '',
        discount_enabled: false,
        discount_type: 'percentage',
        discount_value: '',
      });
      setImages(editingProduct.images || []);
      return;
    }

    resetInternalState();
  }, [isOpen, editingProduct, categories, setCategories, resetInternalState]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    const totalImages = images.length + files.length;

    if (totalImages > 3) {
      toast.error(tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowedPlease_7319ac078b'));
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const responses = await Promise.all(
        files.map((file) => {
          const uploadData = new FormData();
          uploadData.append('image', file);
          return http.post(IMAGE_ENDPOINTS.UPLOAD, uploadData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        })
      );

      const uploadedImages = responses.map((response) => response.data.filename);
      setImages((prev) => [...prev, ...uploadedImages]);
      toast.success(tUi('ui.pages.admin.adminProducts.imagesUploadedSuccessfully_fee7383b18'));
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminProducts.failedToUploadImages_f707ddb8e2'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  const getImagePreviewUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const handleClose = () => {
    resetInternalState();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (images.length < 1) {
      toast.error(tUi('ui.pages.admin.adminProducts.atLeastOneImageIs_8b5c4f7485'));
      return;
    }

    if (images.length > 3) {
      toast.error(tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowed_071181eac3'));
      return;
    }

    setSaving(true);

    try {
      const basePrice = parseFloat(formData.price);
      let discountEnabled = Boolean(formData.discount_enabled);
      let discountType = formData.discount_type;
      let discountValue = parseFloat(formData.discount_value);

      if (editingProduct) {
        discountEnabled = Boolean(editingProduct.discount_enabled);
        discountType = editingProduct.discount_type;
        discountValue = editingProduct.discount_value ?? 0;
      } else if (discountEnabled) {
        const rawDiscountValue = formData.discount_value;
        if (rawDiscountValue === '' || rawDiscountValue === null || rawDiscountValue === undefined) {
          toast.error(tUi('ui.pages.admin.adminProducts.discountValueIsRequiredWhen_7037da0d1a'));
          setSaving(false);
          return;
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
          toast.error(tUi('ui.pages.admin.adminProducts.pleaseSelectAValidDiscount_b85b304c81'));
          setSaving(false);
          return;
        }
        if (Number.isNaN(discountValue) || discountValue <= 0) {
          toast.error(tUi('ui.pages.admin.adminProducts.discountValueMustBeGreater_ef09745ad2'));
          setSaving(false);
          return;
        }
        if (discountType === 'percentage' && discountValue > 100) {
          toast.error(tUi('ui.pages.admin.adminProducts.percentageDiscountCannotBeMore_fa2e324b58'));
          setSaving(false);
          return;
        }
        if (discountType === 'fixed' && discountValue > basePrice) {
          toast.error(tUi('ui.pages.admin.adminProducts.fixedDiscountCannotExceedThe_499b7ac30a'));
          setSaving(false);
          return;
        }
      }

      const productData = {
        ...formData,
        price: basePrice,
        quantity: parseInt(formData.quantity, 10),
        discount_enabled: discountEnabled,
        discount_type: discountEnabled ? discountType : null,
        discount_value: discountEnabled ? discountValue : 0,
        images,
      };

      if (editingProduct) {
        if (!editingProduct.id) {
          toast.error(tUi('ui.pages.admin.adminProducts.errorProductIdIsMissing_7f8228b6c4'));
          setSaving(false);
          return;
        }

        await http.put(buildUrl(PRODUCT_ENDPOINTS.UPDATE, { id: editingProduct.id }), productData);
        toast.success(tUi('ui.pages.admin.adminProducts.productUpdatedSuccessfully_32fdf252d5'));
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, productData);
        toast.success(tUi('ui.pages.admin.adminProducts.productCreatedSuccessfully_132827050a'));
      }

      handleClose();
      if (onSaved) {
        await onSaved();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save product';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="admin-modal-overlay adm-product-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="adm-product-modal admin-modal"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-labelledby="adm-product-modal-title"
          >
            <header className="adm-product-modal-header">
              <div>
                <span className="page-kicker">{panelKicker}</span>
                <h2 id="adm-product-modal-title">
                  {editingProduct
                    ? tUi('ui.pages.admin.adminProducts.editProduct_e63de796e6')
                    : tUi('ui.pages.admin.adminProducts.addNewProduct_109f983c59')}
                </h2>
                <p className="adm-product-modal-subtitle">
                  {editingProduct
                    ? t('ui.pages.admin.adminProducts.modal.editSubtitle')
                    : t('ui.pages.admin.adminProducts.modal.addSubtitle')}
                </p>
              </div>
              <button
                type="button"
                className="adm-product-modal-close"
                onClick={handleClose}
                aria-label={tUi('ui.pages.admin.adminProducts.cancel_bf8eef7581')}
              >
                <FaXmark aria-hidden />
              </button>
            </header>

            <form className="adm-product-modal-form" onSubmit={handleSubmit}>
              <section className="adm-product-modal-section">
                <h3>{t('ui.pages.admin.adminProducts.modal.section.details')}</h3>
                <div className="adm-product-field">
                  <label htmlFor="adm-product-name">{tUi('ui.pages.admin.adminProducts.productName_f2fbd60c6e')}</label>
                  <input
                    id="adm-product-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="adm-product-field">
                  <label htmlFor="adm-product-category">{tUi('ui.pages.admin.adminProducts.categoryName_d2ea6c7aa6')}</label>
                  <select
                    id="adm-product-category"
                    name="category_name"
                    value={formData.category_name}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">{tUi('ui.pages.admin.adminProducts.selectACategory_bb39da5ab8')}</option>
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-product-field">
                  <label htmlFor="adm-product-description">{tUi('ui.pages.admin.adminProducts.description_92d5f9f27a')}</label>
                  <textarea
                    id="adm-product-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows="4"
                  />
                </div>
              </section>

              <section className="adm-product-modal-section">
                <h3>{t('ui.pages.admin.adminProducts.modal.section.localization')}</h3>
                <div className="adm-product-modal-grid adm-product-modal-grid--2">
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-name-ar">{t('ui.pages.admin.adminProducts.nameArabic')}</label>
                    <input
                      id="adm-product-name-ar"
                      type="text"
                      name="name_ar"
                      value={formData.name_ar}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-name-fr">{t('ui.pages.admin.adminProducts.nameFrench')}</label>
                    <input
                      id="adm-product-name-fr"
                      type="text"
                      name="name_fr"
                      value={formData.name_fr}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="adm-product-modal-grid adm-product-modal-grid--2">
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-desc-ar">{t('ui.pages.admin.adminProducts.descriptionArabic')}</label>
                    <textarea
                      id="adm-product-desc-ar"
                      name="description_ar"
                      value={formData.description_ar}
                      onChange={handleInputChange}
                      rows="3"
                    />
                  </div>
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-desc-fr">{t('ui.pages.admin.adminProducts.descriptionFrench')}</label>
                    <textarea
                      id="adm-product-desc-fr"
                      name="description_fr"
                      value={formData.description_fr}
                      onChange={handleInputChange}
                      rows="3"
                    />
                  </div>
                </div>
              </section>

              <section className="adm-product-modal-section">
                <h3>{t('ui.pages.admin.adminProducts.modal.section.pricing')}</h3>
                <div className="adm-product-modal-grid adm-product-modal-grid--2">
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-price">{tUi('ui.pages.admin.adminProducts.price_e83d5427d6')}</label>
                    <input
                      id="adm-product-price"
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="adm-product-field">
                    <label htmlFor="adm-product-quantity">{tUi('ui.pages.admin.adminProducts.quantity_05a793b136')}</label>
                    <input
                      id="adm-product-quantity"
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="adm-product-modal-section">
                <h3>{t('ui.pages.admin.adminProducts.modal.section.images')}</h3>
                <div className="adm-product-upload">
                  <label htmlFor="adm-product-images">{tUi('ui.pages.admin.adminProducts.productImages13Images_b802fc6b5e')}</label>
                  <input
                    id="adm-product-images"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading || images.length >= 3}
                  />
                  <small className="adm-product-upload-hint">
                    {images.length === 0 && tUi('ui.pages.admin.adminProducts.atLeast1ImageIs_5c02b8c404')}
                    {images.length > 0 &&
                      tUi('ui.pages.admin.adminProducts.value3ImagesSelected_586058179b', { value0: images.length })}
                    {' '}
                    {images.length < 3 && tUi('ui.pages.admin.adminProducts.youCanAddMoreImages_60be49e0df')}
                    {images.length >= 3 && tUi('ui.pages.admin.adminProducts.maximum3ImagesReached_b22426d304')}
                  </small>
                  {uploading ? <LoadingSpinner size="small" /> : null}
                  {images.length > 0 ? (
                    <div className="adm-product-images">
                      {images.map((img, index) => (
                        <div key={img || index} className="adm-product-image-tag">
                          <img
                            src={getImagePreviewUrl(img)}
                            alt={tUi('ui.pages.admin.adminProducts.productValue_68027a6752', { value0: index + 1 })}
                            className="adm-product-image-thumb"
                          />
                          <span className="adm-product-image-name">{img.split('/').pop()}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="adm-product-image-remove"
                            title={tUi('ui.pages.admin.adminProducts.removeImage_f5462c1134')}
                          >
                            <FaXmark aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="adm-product-modal-actions">
                <button type="button" className="adm-btn-secondary" onClick={handleClose} disabled={saving}>
                  {tUi('ui.pages.admin.adminProducts.cancel_bf8eef7581')}
                </button>
                <button type="submit" className="adm-btn-primary" disabled={saving || uploading}>
                  {editingProduct
                    ? tUi('ui.pages.admin.adminProducts.update_45dc0cf26a')
                    : tUi('ui.pages.admin.adminProducts.create_a62a4e5374')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ProductFormModal;

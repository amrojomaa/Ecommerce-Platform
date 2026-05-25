import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaMagnifyingGlass, FaPlus, FaTag, FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useConfirm } from '../../hooks/useConfirm';
import { localizeCategoryDescription, localizeCategoryName } from '../../utils/localizedContent';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminCategories.css';

const emptyForm = {
  name: '',
  name_ar: '',
  name_fr: '',
  description: '',
  description_ar: '',
  description_fr: ''
};

const AdminCategories = () => {
  const { t, i18n } = useTranslation();
  const languageCode = i18n.language;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminCategories.failedToFetchCategories_e2e8acf576'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        await http.put(
          CATEGORY_ENDPOINTS.UPDATE.replace('{id}', editingCategory.id),
          formData
        );
        toast.success(tUi('ui.pages.admin.adminCategories.categoryUpdatedSuccessfully_9567db2410'));
      } else {
        await http.post(CATEGORY_ENDPOINTS.CREATE, formData);
        toast.success(tUi('ui.pages.admin.adminCategories.categoryCreatedSuccessfully_390b746ae2'));
      }

      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to save category');
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      name_ar: category.name_ar || '',
      name_fr: category.name_fr || '',
      description: category.description,
      description_ar: category.description_ar || '',
      description_fr: category.description_fr || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: tUi('ui.pages.admin.adminCategories.deleteCategory_be5e4141c7'),
      message: tUi('ui.pages.admin.adminCategories.areYouSureYouWant_cc06d151de'),
      confirmText: tUi('ui.pages.admin.adminCategories.delete_d1c593a8bd'),
      cancelText: tUi('ui.pages.admin.adminCategories.cancel_8d1e566269')
    });
    if (!confirmed) return;

    try {
      await http.delete(CATEGORY_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success(tUi('ui.pages.admin.adminCategories.categoryDeletedSuccessfully_af4e890bd7'));
      fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingCategory(null);
    setShowModal(false);
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    const matched = !term
      ? [...categories]
      : categories.filter(
          (category) =>
            category.name?.toLowerCase().includes(term) ||
            category.description?.toLowerCase().includes(term) ||
            category.name_ar?.toLowerCase().includes(term) ||
            category.name_fr?.toLowerCase().includes(term)
        );
    return matched.sort((a, b) =>
      localizeCategoryName(a, languageCode).localeCompare(localizeCategoryName(b, languageCode))
    );
  }, [categories, term, languageCode]);

  const categoriesTitle = tUi('ui.pages.admin.adminCategories.manageCategories_0cb9f43ae9');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });

  return (
    <div className="admin-page-shell adm-page adm-categories-page">
      <PageHeader
        kicker={panelKicker}
        title={categoriesTitle}
        subtitle={tUi('ui.pages.admin.adminCategories.subtitle_1a2b3c4d5e')}
        actions={
          <motion.button
            type="button"
            className="adm-btn-primary"
            onClick={openCreateModal}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaPlus aria-hidden />
            <span>{tUi('ui.pages.admin.adminCategories.addCategoryBtn_6e7f8a9b0c')}</span>
          </motion.button>
        }
      />

      <section className="adm-cat-section">
        <div className="adm-cat-section-header">
          <h2>
            {tUi('ui.pages.admin.adminCategories.existingCategories_2b3c4d5e6f')}
            <span className="adm-cat-section-count" aria-live="polite">
              {filteredCategories.length}
            </span>
          </h2>
        </div>

        <div className="adm-cat-toolbar">
          <label className="adm-cat-search" htmlFor="adm-cat-search-input">
            <FaMagnifyingGlass className="adm-cat-search-icon" aria-hidden />
            <input
              id="adm-cat-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tUi('ui.pages.admin.adminCategories.searchCategories_7a8b9c0d1e')}
              aria-label={tUi('ui.pages.admin.adminCategories.searchCategories_7a8b9c0d1e')}
            />
            {searchTerm.trim() ? (
              <button type="button" className="adm-cat-search-clear" onClick={() => setSearchTerm('')}>
                {tUi('ui.pages.admin.adminCategories.clear_9a0b1c2d3e')}
              </button>
            ) : null}
          </label>
        </div>

        {loading ? (
          <div className="adm-cat-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="adm-cat-empty">
            <FaTag className="adm-cat-empty-icon" aria-hidden />
            <p>
              {term
                ? tUi('ui.pages.admin.adminCategories.noSearchResults_8b9c0d1e2f')
                : tUi('ui.pages.admin.adminCategories.noCategoriesYet_3c4d5e6f7a')}
            </p>
            {!term && (
              <motion.button
                type="button"
                className="adm-btn-primary"
                onClick={openCreateModal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FaPlus aria-hidden />
                <span>{tUi('ui.pages.admin.adminCategories.addCategoryBtn_6e7f8a9b0c')}</span>
              </motion.button>
            )}
          </div>
        ) : (
          <div className="adm-cat-list">
            {filteredCategories.map((category, index) => {
              const localizedDescription = localizeCategoryDescription(category, languageCode);
              return (
              <motion.article
                key={category.id}
                className="adm-cat-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="adm-cat-card-icon" aria-hidden>
                  <FaTag />
                </div>
                <div className="adm-cat-card-body">
                  <div className="adm-cat-card-top">
                    <h3>{localizeCategoryName(category, languageCode)}</h3>
                  </div>
                  {localizedDescription ? (
                    <p className="adm-cat-card-desc">{localizedDescription}</p>
                  ) : null}
                  <div className="adm-cat-card-actions">
                    <button type="button" className="adm-btn-primary" onClick={() => handleEdit(category)}>
                      {tUi('ui.pages.admin.adminCategories.edit_36f0067e76')}
                    </button>
                    <button type="button" className="adm-btn-danger" onClick={() => handleDelete(category.id)}>
                      {tUi('ui.pages.admin.adminCategories.delete_d1c593a8bd')}
                    </button>
                  </div>
                </div>
              </motion.article>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="adm-cat-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
          >
            <motion.div
              className="adm-cat-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="adm-cat-modal-title"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="adm-cat-modal-header">
                <div>
                  <span className="page-kicker">
                    {editingCategory
                      ? tUi('ui.pages.admin.adminCategories.editCategory_ce33b7c66f')
                      : tUi('ui.pages.admin.adminCategories.addNewCategory_1a6cfcaeec')}
                  </span>
                  <h2 id="adm-cat-modal-title">
                    {editingCategory
                      ? tUi('ui.pages.admin.adminCategories.editCategory_ce33b7c66f')
                      : tUi('ui.pages.admin.adminCategories.addNewCategory_1a6cfcaeec')}
                  </h2>
                </div>
                <button type="button" className="adm-cat-modal-close" onClick={resetForm} aria-label="Close">
                  <FaXmark aria-hidden />
                </button>
              </div>

              <form className="adm-cat-modal-form" onSubmit={handleSubmit}>
                <div className="adm-cat-modal-section">
                  <h3>{tUi('ui.pages.admin.adminCategories.namesSection_4d5e6f7a8b')}</h3>
                  <div className="adm-cat-form-grid adm-cat-form-grid--3">
                    <div className="adm-cat-field">
                      <label htmlFor="cat-name">{tUi('ui.pages.admin.adminCategories.categoryName_2e4cd0a7dc')}</label>
                      <input
                        id="cat-name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="adm-cat-field">
                      <label htmlFor="cat-name-ar">{tUi('ui.pages.admin.adminProducts.nameArabic')}</label>
                      <input
                        id="cat-name-ar"
                        type="text"
                        name="name_ar"
                        value={formData.name_ar}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="adm-cat-field">
                      <label htmlFor="cat-name-fr">{tUi('ui.pages.admin.adminProducts.nameFrench')}</label>
                      <input
                        id="cat-name-fr"
                        type="text"
                        name="name_fr"
                        value={formData.name_fr}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="adm-cat-modal-section">
                  <h3>{tUi('ui.pages.admin.adminCategories.descriptionsSection_5e6f7a8b9c')}</h3>
                  <div className="adm-cat-form-grid">
                    <div className="adm-cat-field">
                      <label htmlFor="cat-desc">{tUi('ui.pages.admin.adminCategories.description_da743ae7b0')}</label>
                      <textarea
                        id="cat-desc"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                        rows={3}
                      />
                    </div>
                    <div className="adm-cat-field">
                      <label htmlFor="cat-desc-ar">{tUi('ui.pages.admin.adminProducts.descriptionArabic')}</label>
                      <textarea
                        id="cat-desc-ar"
                        name="description_ar"
                        value={formData.description_ar}
                        onChange={handleInputChange}
                        rows={3}
                      />
                    </div>
                    <div className="adm-cat-field">
                      <label htmlFor="cat-desc-fr">{tUi('ui.pages.admin.adminProducts.descriptionFrench')}</label>
                      <textarea
                        id="cat-desc-fr"
                        name="description_fr"
                        value={formData.description_fr}
                        onChange={handleInputChange}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="adm-cat-modal-actions">
                  <button type="button" className="adm-btn-secondary" onClick={resetForm}>
                    {tUi('ui.pages.admin.adminCategories.cancel_8d1e566269')}
                  </button>
                  <button type="submit" className="adm-btn-primary">
                    {editingCategory
                      ? tUi('ui.pages.admin.adminCategories.update_146d1db624')
                      : tUi('ui.pages.admin.adminCategories.create_534e360482')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCategories;

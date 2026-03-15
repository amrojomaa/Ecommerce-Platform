import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS } from '../../config/api';
import { useLanguage } from '../../hooks/useLanguage';
import { useDialog } from '../../hooks/useDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminCategories.css';

const AdminCategories = () => {
  const { t } = useLanguage();
  const { showConfirm } = useDialog();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(response.data);
    } catch (error) {
      toast.error(t('failedFetchCategories', 'Failed to fetch categories'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
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
        toast.success(t('categoryUpdatedSuccessfully', 'Category updated successfully'));
      } else {
        await http.post(CATEGORY_ENDPOINTS.CREATE, formData);
        toast.success(t('categoryCreatedSuccessfully', 'Category created successfully'));
      }
      
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.message || t('failedSaveCategory', 'Failed to save category'));
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      message: t('confirmDeleteCategory', 'Are you sure you want to delete this category?'),
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(CATEGORY_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success(t('categoryDeletedSuccessfully', 'Category deleted successfully'));
      fetchCategories();
    } catch (error) {
      toast.error(error.message || t('failedDeleteCategory', 'Failed to delete category'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingCategory(null);
    setShowModal(false);
  };

  return (
    <div className="admin-categories">
      <div className="admin-categories-header">
        <h1>{t('manageCategories', 'Manage Categories')}</h1>
        <motion.button
          className="add-category-btn"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          + {t('addCategory', 'Add Category')}
        </motion.button>
      </div>

      {loading ? (
        <div className="categories-loading">
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              className="category-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="category-icon">🏷️</div>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
              <div className="category-actions">
                <button
                  onClick={() => handleEdit(category)}
                  className="edit-btn"
                >
                  {t('edit', 'Edit')}
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="delete-btn"
                >
                  {t('delete', 'Delete')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>
                {editingCategory ? t('editCategory', 'Edit Category') : t('addNewCategory', 'Add New Category')}
              </h2>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{t('categoryName', 'Category Name')} *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('description', 'Description')} *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows="4"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="cancel-btn"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button type="submit" className="save-btn">
                    {editingCategory ? t('update', 'Update') : t('create', 'Create')}
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

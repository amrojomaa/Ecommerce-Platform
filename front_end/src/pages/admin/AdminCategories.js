import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { CATEGORY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminCategories.css';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const confirm = useConfirm();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(response.data);
    } catch (error) {
      toast.error(tUi("ui.pages.admin.adminCategories.failedToFetchCategories_e2e8acf576"));
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
        toast.success(tUi("ui.pages.admin.adminCategories.categoryUpdatedSuccessfully_9567db2410"));
      } else {
        await http.post(CATEGORY_ENDPOINTS.CREATE, formData);
        toast.success(tUi("ui.pages.admin.adminCategories.categoryCreatedSuccessfully_390b746ae2"));
      }

      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to save category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.admin.adminCategories.deleteCategory_be5e4141c7"),
      message: tUi("ui.pages.admin.adminCategories.areYouSureYouWant_cc06d151de"),
      confirmText: tUi("ui.pages.admin.adminCategories.delete_d1c593a8bd"),
      cancelText: tUi("ui.pages.admin.adminCategories.cancel_8d1e566269")
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(CATEGORY_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success(tUi("ui.pages.admin.adminCategories.categoryDeletedSuccessfully_af4e890bd7"));
      fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    });
    setEditingCategory(null);
    setShowModal(false);
  };

  return (
    <div className="admin-categories">
      <div className="admin-categories-header">
        <h1>{tUi("ui.pages.admin.adminCategories.manageCategories_0cb9f43ae9")}</h1>
        <motion.button
          className="add-category-btn"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>{tUi("ui.pages.admin.adminCategories.addCategory_32232f6ec9")}


        </motion.button>
      </div>

      {loading ?
      <div className="categories-loading">
          <LoadingSpinner size="large" />
        </div> :

      <div className="categories-grid">
          {categories.map((category, index) =>
        <motion.div
          key={category.id}
          className="category-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.02 }}>
          
              <div className="category-icon">🏷️</div>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
              <div className="category-actions">
                <button
              onClick={() => handleEdit(category)}
              className="edit-btn">{tUi("ui.pages.admin.adminCategories.edit_36f0067e76")}


            </button>
                <button
              onClick={() => handleDelete(category.id)}
              className="delete-btn">{tUi("ui.pages.admin.adminCategories.delete_d1c593a8bd")}


            </button>
              </div>
            </motion.div>
        )}
        </div>
      }

      <AnimatePresence>
        {showModal &&
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetForm}>
          
            <motion.div
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            
              <h2>
                {editingCategory ? tUi("ui.pages.admin.adminCategories.editCategory_ce33b7c66f") : tUi("ui.pages.admin.adminCategories.addNewCategory_1a6cfcaeec")}
              </h2>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminCategories.categoryName_2e4cd0a7dc")}</label>
                  <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required />
                
                </div>

                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminCategories.description_da743ae7b0")}</label>
                  <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows="4" />
                
                </div>

                <div className="modal-actions">
                  <button
                  type="button"
                  onClick={resetForm}
                  className="cancel-btn">{tUi("ui.pages.admin.adminCategories.cancel_8d1e566269")}


                </button>
                  <button type="submit" className="save-btn">
                    {editingCategory ? tUi("ui.pages.admin.adminCategories.update_146d1db624") : tUi("ui.pages.admin.adminCategories.create_534e360482")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default AdminCategories;

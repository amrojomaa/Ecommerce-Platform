import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import http from '../services/http';
import { FEEDBACK_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/components/CustomerFeedbackPopup.css';

const POPUP_STORAGE_PREFIX = 'customer-feedback-popup-next:';
const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const CustomerFeedbackPopup = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const isCustomer = useMemo(() => user?.role === 'customer', [user?.role]);
  const canShowPopup = isAuthenticated && isCustomer;
  const popupStorageKey = useMemo(() => `${POPUP_STORAGE_PREFIX}${user?.id || 'guest'}`, [user?.id]);

  const openPopup = useCallback(() => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    setIsOpen(true);
  }, []);

  const markCurrentMonthHandled = useCallback(() => {
    localStorage.setItem(popupStorageKey, getCurrentMonthKey());
  }, [popupStorageKey]);

  const handleMaybeLater = useCallback(() => {
    markCurrentMonthHandled();
    setIsOpen(false);
  }, [markCurrentMonthHandled]);

  useEffect(() => {
    if (!canShowPopup) {
      setIsOpen(false);
      return undefined;
    }

    const handledMonth = localStorage.getItem(popupStorageKey);
    const currentMonth = getCurrentMonthKey();
    if (handledMonth !== currentMonth) {
      openPopup();
    } else {
      setIsOpen(false);
    }
    return undefined;
  }, [canShowPopup, openPopup, popupStorageKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error(t('ui.feedback.toast.chooseRating'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await http.post(FEEDBACK_ENDPOINTS.ME, {
        rating,
        comment: comment.trim() ? comment.trim() : null
      });

      setRating(response?.data?.rating || rating);
      setComment(response?.data?.comment || '');
      markCurrentMonthHandled();
      setIsOpen(false);
      toast.success(t('ui.feedback.toast.submitted'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.feedback.toast.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canShowPopup || !isOpen) {
    return null;
  }

  return (
    <div
      className="customer-feedback-popup-overlay"
      role="presentation"
      onClick={handleMaybeLater}>
      
      <div
        className="customer-feedback-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-feedback-popup-title"
        onClick={(event) => event.stopPropagation()}>
        
        <h3 id="customer-feedback-popup-title">{t("feedback.title")}</h3>
        <p>{t("feedback.description")}</p>
        <form onSubmit={handleSubmit}>
          <div
            className="customer-feedback-popup-stars"
            onMouseLeave={() => setHoverRating(0)}>
            
            {[1, 2, 3, 4, 5].map((starValue) => {
              const activeRating = hoverRating || rating;
              const isActive = starValue <= activeRating;
              return (
                <button
                  key={starValue}
                  type="button"
                  className={`customer-feedback-popup-star-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setRating(starValue)}
                  onMouseEnter={() => setHoverRating(starValue)}
                  aria-label={t("feedback.rateAria", { count: starValue })}>
                  
                  <FaStar />
                </button>);

            })}
          </div>

          <textarea
            className="customer-feedback-popup-textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("feedback.commentPlaceholder")}
            maxLength={1000}
            rows={4} />
          

          <div className="customer-feedback-popup-actions">
            <button
              type="submit"
              className="customer-feedback-popup-submit-btn"
              disabled={submitting || rating < 1}>
              
              {submitting ? t("feedback.saving") : t("feedback.submit")}
            </button>
            <button
              type="button"
              className="customer-feedback-popup-maybe-later-btn"
              onClick={handleMaybeLater}
              disabled={submitting}>
              
              {t("feedback.maybeLater")}
            </button>
          </div>
        </form>
      </div>
    </div>);

};

export default CustomerFeedbackPopup;

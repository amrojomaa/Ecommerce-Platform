import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHeadset, FaShieldAlt, FaTruck } from 'react-icons/fa';
import PageHeader from '../components/PageHeader';
import { tUi } from '../i18n/uiText';
import { useTranslation } from 'react-i18next';
import '../styles/pages/AboutUs.css';

const AboutUs = () => {
  const { t } = useTranslation();

  return (
    <div className="about-page page-shell">
      <PageHeader
        kicker={t('aboutUs.kicker')}
        title={t('aboutUs.title')}
        subtitle={t('aboutUs.subtitle')}
      />

      <section className="about-value-props-section">
        <div className="about-section-header">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {tUi('ui.pages.home.valuePropsTitle_f8f0c4ad1a')}
          </motion.h2>
          <p className="about-section-subtitle">
            {tUi('ui.pages.home.valuePropsSubtitle_0aa1c14a1b')}
          </p>
        </div>
        <div className="about-value-props-grid">
          <motion.article
            className="about-value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <span className="about-value-prop-icon" aria-hidden>
              <FaTruck />
            </span>
            <h3>{tUi('ui.pages.home.valuePropDeliveryTitle_1d1ac5c1d0')}</h3>
            <p>{tUi('ui.pages.home.valuePropDeliveryBody_2c33b0dd6f')}</p>
          </motion.article>
          <motion.article
            className="about-value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <span className="about-value-prop-icon" aria-hidden>
              <FaShieldAlt />
            </span>
            <h3>{tUi('ui.pages.home.valuePropPaymentsTitle_7f8b4c3d2a')}</h3>
            <p>{tUi('ui.pages.home.valuePropPaymentsBody_3e51c43f90')}</p>
          </motion.article>
          <motion.article
            className="about-value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <span className="about-value-prop-icon" aria-hidden>
              <FaHeadset />
            </span>
            <h3>{tUi('ui.pages.home.valuePropSupportTitle_7a8f1b90ad')}</h3>
            <p>{tUi('ui.pages.home.valuePropSupportBody_1b8b2d09d8')}</p>
          </motion.article>
        </div>
      </section>

      <section className="about-promo-band">
        <div className="about-promo-content">
          <div>
            <h3>{tUi('ui.pages.home.promoTitle_5f7b0db4da')}</h3>
            <p>{tUi('ui.pages.home.promoBody_0dc5f5e2c8')}</p>
          </div>
          <Link to="/products" className="about-promo-cta">
            {tUi('ui.pages.home.promoCta_32bb6c9d5d')}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;

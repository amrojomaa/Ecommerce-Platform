import React from 'react';
import { motion } from 'framer-motion';

const PageHeader = ({
  kicker,
  title,
  subtitle,
  accent,
  actions,
  className = '',
  animate = true
}) => {
  const kickerClass = accent === 'discount'
    ? 'page-kicker page-kicker--discount'
    : 'page-kicker';

  const TitleTag = animate ? motion.h1 : 'h1';
  const titleProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
      }
    : {};

  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header-top">
        <div className="page-header-copy">
          {kicker && <span className={kickerClass}>{kicker}</span>}
          <TitleTag {...titleProps}>{title}</TitleTag>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
};

export default PageHeader;

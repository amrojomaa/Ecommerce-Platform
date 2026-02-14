import React from 'react';
import '../styles/components/LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium' }) => {
  return (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;

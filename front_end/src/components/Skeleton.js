import React from 'react';
import '../styles/components/Skeleton.css';

const Skeleton = ({ type = 'text', width, height, className = '' }) => {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div className={`skeleton skeleton-${type} ${className}`} style={style}></div>);

};

export const ProductCardSkeleton = () => {
  return (
    <div className="product-card-skeleton">
      <Skeleton type="image" height="200px" />
      <div className="skeleton-content">
        <Skeleton type="text" width="80%" height="20px" />
        <Skeleton type="text" width="60%" height="16px" />
        <Skeleton type="text" width="40%" height="24px" />
      </div>
    </div>);

};

export default Skeleton;

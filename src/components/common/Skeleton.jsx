// src/components/common/Skeleton.jsx

import React from 'react';

// Using Named Export to avoid import confusion
export const Skeleton = ({ variant = 'text', width, height, className = '', count = 1 }) => {
  const baseClasses = "animate-pulse bg-gray-200";
  
  let variantClasses = "";
  let style = {};

  switch (variant) {
    case 'circular':
      variantClasses = "rounded-full";
      style = { width: width || '40px', height: height || '40px' };
      break;
    case 'rectangular':
      variantClasses = "rounded-xl"; 
      style = { width: width || '100%', height: height || '100px' };
      break;
    case 'text':
    default:
      variantClasses = "rounded";
      style = { width: width || '100%', height: height || '1rem' };
      break;
  }

  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div 
            key={index} 
            className={`${baseClasses} ${variantClasses} ${className}`}
            style={style}
          />
        ))}
      </>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
    />
  );
};
// src/components/common/Card.jsx

import React from 'react';

const Card = ({ 
  children, 
  title, 
  subtitle,
  icon: Icon,
  className = '',
  padding = 'p-6'
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-md ${padding} ${className}`}>
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon className="w-6 h-6 text-blue-600" />
            </div>
          )}
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
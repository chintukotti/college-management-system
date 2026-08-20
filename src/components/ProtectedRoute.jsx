// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './common/Loading';

/**
 * ProtectedRoute - Protects routes based on authentication and role
 * 
 * @param {ReactNode} children - Components to render if authorized
 * @param {Array} allowedRoles - Array of roles allowed to access this route
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { currentUser, userRole, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return <Loading />;
  }

  // Not logged in - redirect to login
  if (!currentUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check if user's role is allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    const dashboardPaths = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      student: '/student/dashboard'
    };
    
    return <Navigate to={dashboardPaths[userRole] || '/'} replace />;
  }

  // User is authorized
  return children;
};

export default ProtectedRoute;
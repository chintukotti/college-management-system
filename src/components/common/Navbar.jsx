// src/components/common/Navbar.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Home, Users, ClipboardList, Layers, Megaphone, ChevronDown, Key, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser, subscribeToLatestAnnouncement } from '../../firebase/services';
import toast from 'react-hot-toast';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { currentUser, userRole, clearStudentSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (userRole !== 'student' || !currentUser?.classId) {
      setHasUnread(false);
      return;
    }

    const unsubscribe = subscribeToLatestAnnouncement(currentUser.classId, (latestMs) => {
      const lastVisited = parseInt(localStorage.getItem('announcementLastVisited') || '0', 10);
      setHasUnread(latestMs > lastVisited);
    });

    return () => unsubscribe();
  }, [userRole, currentUser?.classId]); // ✅ FIXED: Removed location.pathname

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDashboardPath = () => {
    switch (userRole) {
      case 'admin': return '/admin/dashboard';
      case 'teacher': return '/teacher/dashboard';
      case 'student': return '/student/dashboard';
      default: return '/';
    }
  };

  const getNavLinks = () => {
    switch (userRole) {
      case 'admin':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
          { path: '/admin/teachers', label: 'Teachers', icon: Users },
          { path: '/admin/classes', label: 'Classes', icon: Layers },
        ];
      case 'teacher':
        return [
          { path: '/teacher/dashboard', label: 'Dashboard', icon: Home },
          { path: '/teacher/announcements', label: 'Announcements', icon: Megaphone },
        ];
      case 'student':
        return [
          { path: '/student/dashboard', label: 'Dashboard', icon: Home },
          { path: '/student/announcements', label: 'Announcements', icon: Megaphone, hasDot: hasUnread },
          { path: '/student/attendance', label: 'Attendance', icon: ClipboardList },
        ];
      default: return [];
    }
  };

  const handleLogout = async () => {
    const result = await logoutUser(userRole);
    if (result.success) {
      if (userRole === 'student') clearStudentSession();
      toast.success('Logged out successfully');
      navigate('/');
    } else {
      toast.error('Failed to logout');
    }
  };

  const isActive = (path) => location.pathname === path;

  const renderLink = (link) => {
    return (
      <Link
        key={link.path + link.label}
        to={link.path}
        onClick={() => setIsOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm relative
          ${isActive(link.path) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
          ${isOpen ? 'w-full' : ''}
        `}
      >
        <link.icon className="w-4 h-4" />
        {link.label}
        {link.hasDot && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
      </Link>
    );
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to={currentUser ? getDashboardPath() : '/'} className="flex items-center gap-2">
              <img src="/rgukt.png" alt="Logo" className="h-8 w-auto object-contain" />
              <span className="font-bold text-xl text-gray-800 hidden sm:block">
                College<span className="text-red-600">MS</span>
              </span>
            </Link>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-2">
            {getNavLinks().map(renderLink)}
            {currentUser && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l relative" ref={dropdownRef}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                >
                  <div className="text-right hidden lg:block">
                    <p className="text-sm font-medium text-gray-800">{currentUser?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                  </div>
                  <User className="w-6 h-6 text-gray-500 lg:hidden" />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border py-2 z-50">
                    {userRole === 'student' && (
                      <Link to="/student/change-password" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50">
                        <Key className="w-4 h-4"/> Change Password
                      </Link>
                    )}
                    {/* ✅ NEW: Teacher Change Password */}
                    {userRole === 'teacher' && (
                      <Link to="/teacher/change-password" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50">
                        <Key className="w-4 h-4"/> Change Password
                      </Link>
                    )}
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50">
                      <LogOut className="w-4 h-4"/> Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Header Right Side */}
          <div className="md:hidden flex items-center gap-2">
             {userRole === 'student' && (
               <Link to="/student/announcements" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                 <Megaphone className="w-6 h-6" />
                 {hasUnread && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>}
               </Link>
             )}
             <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-2 space-y-1">
            {currentUser && (
              <div className="px-3 py-2 mb-2 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-800">{currentUser?.name || 'User'}</p>
                <p className="text-sm text-gray-500 capitalize">{userRole}</p>
              </div>
            )}
            {getNavLinks().map(renderLink)}
            
           
            {userRole === 'student' && (
                <Link to="/student/change-password" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Key className="w-5 h-5" /> Change Password
                </Link>
            )}
            {/* ✅ NEW: Teacher Change Password */}
            {userRole === 'teacher' && (
                <Link to="/teacher/change-password" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Key className="w-5 h-5" /> Change Password
                </Link>
            )}

            {currentUser && (
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" /> Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
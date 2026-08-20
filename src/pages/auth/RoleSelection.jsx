// src/pages/auth/RoleSelection.jsx

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck, BookOpen, User, ArrowRight } from 'lucide-react';

const RoleSelection = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const roles = [
    {
      id: 'admin',
      title: 'Admin',
      description: 'Manage teachers and system settings',
      icon: ShieldCheck,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    },
    {
      id: 'teacher',
      title: 'Teacher',
      description: 'See classes and manage attendance',
      icon: BookOpen,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      id: 'student',
      title: 'Student',
      description: 'View your attendance and progress',
      icon: User,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    }
  ];

  const handleRoleSelect = (role) => {
    navigate(`/login/${role}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="p-3 sm:p-4 bg-white rounded-full shadow-lg">
              <GraduationCap className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2 px-4">
            College Management System
          </h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg">
            Select your role to continue
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className="group bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 
                         transition-all duration-300 hover:shadow-xl 
                         hover:-translate-y-1 text-left active:scale-95"
            >
              <div className={`${role.color} w-14 h-14 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl 
                              flex items-center justify-center mb-4
                              transition-transform group-hover:scale-110`}>
                <role.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              
              <h2 className="text-xl sm:text-xl font-bold text-gray-800 mb-2">
                {role.title}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                {role.description}
              </p>
              
              <div className="flex items-center text-blue-600 font-medium text-sm sm:text-base">
                Login as {role.title}
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-2" />
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-10 text-gray-500 flex flex-col gap-2">
          <p className="text-xs sm:text-sm">© {currentYear} College Management System. All rights reserved.</p>
          <Link to="/contact" className="text-blue-600 hover:underline text-xs sm:text-sm transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
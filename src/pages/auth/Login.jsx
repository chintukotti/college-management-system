// src/pages/auth/Login.jsx

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowLeft,
  ShieldCheck,
  BookOpen,
  User,
  IdCard,
  Eye,
  EyeOff
} from 'lucide-react';
import { loginUser } from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

const Login = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const { setStudentSession } = useAuth(); // Get session setter
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roleConfig = {
    admin: {
      title: 'Admin',
      icon: ShieldCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Manage teachers, classes and system',
      identifierLabel: 'Email Address',
      identifierPlaceholder: 'admin@rguktsklm.ac.in',
      identifierIcon: Mail
    },
    teacher: {
      title: 'Teacher',
      icon: BookOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Manage semesters, subjects and attendance',
      identifierLabel: 'Email Address',
      identifierPlaceholder: 'teacher@rguktsklm.ac.in',
      identifierIcon: Mail
    },
    student: {
      title: 'Student',
      icon: User,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'View your attendance and progress',
      identifierLabel: 'Student ID',
      identifierPlaceholder: 'S210001, S210002, etc.',
      identifierIcon: IdCard
    }
  };

  const config = roleConfig[role] || roleConfig.student;
  const IdentifierIcon = config.identifierIcon;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await loginUser(formData.identifier, formData.password);
    
    if (result.success) {
      if (result.user.role !== role) {
        toast.error(`This account is not registered as ${config.title}`);
        setLoading(false);
        return;
      }

      // If student, manually set session in context
      if (role === 'student') {
        setStudentSession(result.user);
      }

      toast.success(`Welcome back, ${result.user.name}!`);
      
      const dashboardPaths = {
        admin: '/admin/dashboard',
        teacher: '/teacher/dashboard',
        student: '/student/dashboard'
      };
      navigate(dashboardPaths[role]);
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  // ... (Rest of the component remains the same)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link 
          to="/" 
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to role selection
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
             {/* Added Logo Here too */}
             <div className="flex justify-center mb-4">
                <img src="/rgukt.png" alt="Logo" className="h-12 w-auto object-contain" />
             </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {config.title} Login
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              {config.description}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label={config.identifierLabel}
              type="text"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              placeholder={config.identifierPlaceholder}
              icon={IdentifierIcon}
              required
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              fullWidth
              className="mt-6 bg-red-600 hover:bg-red-700" // Explicitly Red
            >
              Sign In
            </Button>
          </form>

          {role === 'student' && (
            <div className="mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700 text-center">
                <strong>Note:</strong> Use your Student ID (e.g., S210001) and password provided by admin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
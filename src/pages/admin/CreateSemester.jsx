// src/pages/admin/CreateSemester.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Layers, Calendar, FileText } from 'lucide-react';
import { createSemester } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const CreateSemester = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    teacherId: '', // Admin creates generic semesters, maybe assigned later? 
                   // Or simply Admin creates it, then adds subjects.
                   // Let's assume Admin just creates the container here.
    teacherName: 'Admin' 
  });
  
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);
    
    const result = await createSemester({
      ...formData,
      createdBy: currentUser.uid, // ADD THIS LINE
      createdAt: new Date()
    });
    
    if (result.success) {
      toast.success('Semester created successfully!');
      navigate('/admin/semesters');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/admin/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>

        <Card>
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-indigo-100 rounded-full mb-4">
              <Layers className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              Create New Semester
            </h1>
            <p className="text-gray-600 mt-2">
              Define the academic period
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label="Semester Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Semester 1 - 2024"
              icon={FileText}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                icon={Calendar}
                required
              />

              <Input
                label="End Date"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                icon={Calendar}
                required
              />
            </div>

            <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-gray-700">
                Set as active semester
              </label>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin/dashboard')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                fullWidth
              >
                Create Semester
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default CreateSemester;
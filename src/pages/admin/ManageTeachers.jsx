// src/pages/admin/ManageTeachers.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, UserPlus, Trash2, Users, Search, Calendar, Mail 
} from 'lucide-react';
import { getUsersByRole, deleteUser } from '../../firebase/services';
import { compareByName, stripHonorifics } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ManageTeachers = () => {
  const { currentUser } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async (force = false) => {
    const result = await getUsersByRole('teacher', currentUser.uid, force);
    if (result.success) {
      // Alphabetical by actual name: "Dr. Ramesh" sorts under R, not D
      const sorted = [...result.data].sort(compareByName);
      setTeachers(sorted);
      setFilteredTeachers(sorted);
    } else {
      toast.error('Failed to fetch teachers');
    }
    setLoading(false);
  };

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setFilteredTeachers(teachers);
      return;
    }

    // Search matches the name with or without its title, so "ramesh" finds
    // "Dr. Ramesh Kumar" and "dr ramesh" still works too.
    const filtered = teachers.filter(teacher => {
      const name = (teacher.name || '').toLowerCase();
      const bareName = stripHonorifics(teacher.name).toLowerCase();
      const email = (teacher.email || '').toLowerCase();
      return name.includes(term) || bareName.includes(term) || email.includes(term);
    });
    setFilteredTeachers(filtered);
  }, [searchTerm, teachers]);

  const handleDelete = async (teacherId, teacherName) => {
    if (!window.confirm(`Are you sure you want to delete ${teacherName}?`)) return;
    
    setDeleting(teacherId);
    const result = await deleteUser(teacherId);
    
    if (result.success) {
      toast.success('Teacher deleted successfully');
      setTeachers(prev => prev.filter(t => t.id !== teacherId));
    } else {
      toast.error('Failed to delete teacher');
    }
    setDeleting(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/admin/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-3 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Teachers</h1>
              <p className="text-gray-600 mt-1">{teachers.length} {teachers.length === 1 ? 'teacher' : 'teachers'} registered</p>
            </div>
            <Link to="/admin/add-teacher">
              <Button icon={UserPlus}>Add Teacher</Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Teacher List */}
        {filteredTeachers.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {searchTerm ? 'No teachers found' : 'No teachers registered yet'}
            </h3>
            {searchTerm ? (
              <p className="text-gray-500">Try a different search term</p>
            ) : (
              <>
                <p className="text-gray-500 mb-6">Add your first teacher to get started</p>
                <Link to="/admin/add-teacher">
                  <Button icon={UserPlus}>Add Teacher</Button>
                </Link>
              </>
            )}
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTeachers.map((teacher) => (
              <Card key={teacher.id} className="hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Teacher Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-lg font-bold text-white">
                        {/* Initial of the real name, not the title */}
                        {(stripHonorifics(teacher.name).charAt(0) || '?').toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">
                        {teacher.name}
                      </h3>
                      
                      {/* Email */}
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-600 text-sm truncate">{teacher.email}</p>
                      </div>

                      {/* Date Added */}
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-500 text-sm">Joined {formatDate(teacher.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                    <Link to={`/admin/teacher/${teacher.id}/activity`}>
                      <Button variant="secondary" size="sm" icon={Calendar}>
                        Activity
                      </Button>
                    </Link>

                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(teacher.id, teacher.name)}
                      loading={deleting === teacher.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageTeachers;
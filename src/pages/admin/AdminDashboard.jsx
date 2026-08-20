import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, BookOpen, TrendingUp, GraduationCap, FolderPlus, Layers, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleCount, getCollectionCount, getAllAttendance, getUnreadMessageCount } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({ teachers: 0, students: 0, classes: 0, subjects: 0, avgAttendance: 0 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  // Counts come from Firestore's aggregation API: counting 1,500 students bills
  // 2 reads instead of downloading 1,500 documents just to call .length on them.
  const fetchStats = async () => {
    try {
      const [teacherCount, studentCount, classCount, subjectCount, attendanceResult, unreadResult] =
        await Promise.all([
          getRoleCount('teacher', currentUser.uid),
          getRoleCount('student', currentUser.uid),
          getCollectionCount('classes', currentUser.uid),
          getCollectionCount('subjects', currentUser.uid),
          getAllAttendance(),
          getUnreadMessageCount()
        ]);

      let avgAttendance = 0;
      if (attendanceResult.success && attendanceResult.data.length > 0) {
        const presentCount = attendanceResult.data
          .filter(a => a.status === 'present')
          .reduce((sum, a) => sum + (a.count || 1), 0);
        const totalCount = attendanceResult.data
          .reduce((sum, a) => sum + (a.maxCount || a.count || 1), 0);
        avgAttendance = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
      }

      setStats({
        teachers: teacherCount.count,
        students: studentCount.count,
        classes: classCount.count,
        subjects: subjectCount.count,
        avgAttendance
      });
      setUnreadMessages(unreadResult.count);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const DashboardSkeleton = () => (
    <div className="animate-pulse">
      <div className="mb-8">
        <Skeleton width="300px" height="32px" className="mb-2" />
        <Skeleton width="200px" height="16px" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-8">
        {[1,2,3,4,5].map(i => <Skeleton key={i} variant="rectangular" height="100px" className="rounded-xl" />)}
      </div>
      <Skeleton width="150px" height="20px" className="mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} variant="rectangular" height="90px" className="rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Welcome back, {currentUser?.name}! 👋
              </h1>
              <p className="text-gray-600 mt-2">Manage your college system from here.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Teachers</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.teachers}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Students</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.students}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Classes</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.classes}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Layers className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Subjects</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.subjects}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
              </Card>

              <Card className={`bg-gradient-to-br ${stats.avgAttendance >= 75 ? 'from-emerald-500 to-emerald-600' : stats.avgAttendance >= 50 ? 'from-yellow-500 to-yellow-600' : 'from-red-500 to-red-600'} text-white shadow-md hover:shadow-lg transition-all duration-300`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-sm font-medium">Avg. Attendance</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.avgAttendance}%</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <Link to="/admin/add-teacher" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-blue-100 hover:border-blue-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <UserPlus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Add Teacher</h3>
                      <p className="text-sm text-gray-500">Create teacher account</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/create-class" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-green-100 hover:border-green-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                      <FolderPlus className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Create Class</h3>
                      <p className="text-sm text-gray-500">Upload Excel to create</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/teachers" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-purple-100 hover:border-purple-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Manage Teachers</h3>
                      <p className="text-sm text-gray-500">View all teachers</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/classes" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-orange-100 hover:border-orange-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Layers className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Manage Classes</h3>
                      <p className="text-sm text-gray-500">View all classes</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/semesters" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-indigo-100 hover:border-indigo-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <Calendar className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Manage Semesters</h3>
                      <p className="text-sm text-gray-500">Add & view semesters</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/messages" className="group">
                <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-pink-100 hover:border-pink-400 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="relative p-2.5 bg-pink-50 rounded-lg group-hover:bg-pink-100 transition-colors">
                      <Mail className="w-6 h-6 text-pink-600" />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-md border-2 border-white">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Messages</h3>
                      <p className="text-sm text-gray-500">View contact forms</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
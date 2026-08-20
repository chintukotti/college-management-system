// src/pages/teacher/TeacherDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Layers, ClipboardList, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjectsByTeacher } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Loading from '../../components/common/Loading';

const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState([]); // Store subjects directly
  const [semesters, setSemesters] = useState([]); // Derived semesters
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async (force = false) => {
    if (!currentUser?.uid) return;

    // 1. Get all subjects for this teacher
    const subjectsResult = await getSubjectsByTeacher(currentUser.uid, force);

    if (subjectsResult.success) {
      setSubjects(subjectsResult.data);

      // 2. Derive Semesters from the subjects
      const uniqueSemesterIds = [...new Set(subjectsResult.data.map(s => s.semesterId))];
      const derivedSemesters = uniqueSemesterIds.map(semId => {
        const firstSub = subjectsResult.data.find(s => s.semesterId === semId);
        return {
          id: semId,
          name: firstSub?.semesterName || 'Unknown Semester',
          subjects: subjectsResult.data.filter(s => s.semesterId === semId)
        };
      });

      setSemesters(derivedSemesters);

      // 3. Session counts come from the dates already denormalised onto each
      //    subject document. The old version queried every attendance record
      //    for every subject/class pair — thousands of reads on each dashboard
      //    load — to produce numbers that were never even rendered.
      let sessions = 0;
      let classesCovered = new Set();

      subjectsResult.data.forEach(subject => {
        const classDates = subject.classDates || {};
        Object.entries(classDates).forEach(([classId, dates]) => {
          sessions += (dates || []).length;
          classesCovered.add(classId);
        });
      });

      setTotalSessions(sessions);
      setTotalClasses(classesCovered.size);
    }

    setLoading(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Welcome, {currentUser?.name || 'Teacher'}! 👋
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Manage assigned semesters and subjects.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
           {/* ... Stats Cards (Same as previous version) ... */}
           <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs sm:text-sm">Semesters</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{semesters.length}</p>
              </div>
              <Layers className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs sm:text-sm">Subjects</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{subjects.length}</p>
              </div>
              <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-blue-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs sm:text-sm">Classes</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{totalClasses}</p>
              </div>
              <Users className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs sm:text-sm">Sessions</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{totalSessions}</p>
              </div>
              <ClipboardList className="w-8 h-8 sm:w-12 sm:h-12 text-purple-200" />
            </div>
          </Card>
        </div>

        {/* REMOVE Quick Actions (Create buttons) - Teacher no longer creates */}

        {/* Assigned Semesters Section */}
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Assigned Semesters</h2>
        
        {semesters.length === 0 ? (
          <Card className="text-center py-8 sm:py-12 mb-6">
            <Layers className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-base sm:text-lg mb-4">
              No semesters assigned to you yet
            </p>
            <p className="text-sm text-gray-400">Ask admin to assign you to a semester and subject.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {semesters.map((semester) => (
              <Link key={semester.id} to={`/teacher/semester/${semester.id}`}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer h-full active:scale-[0.98]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg">
                      <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                    {semester.name}
                  </h3>
                  
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 pt-3 border-t">
                    <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                    {semester.subjects.length} Subjects
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
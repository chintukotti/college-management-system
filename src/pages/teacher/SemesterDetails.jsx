// src/pages/teacher/SemesterDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Layers } from 'lucide-react';
import { getSubjectsByTeacher } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Loading from '../../components/common/Loading';
import { useAuth } from '../../contexts/AuthContext';

const SemesterDetails = () => {
  const { semesterId } = useParams();
  const { currentUser } = useAuth();
  
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semesterName, setSemesterName] = useState('');

  useEffect(() => {
    fetchMySubjects();
  }, [semesterId, currentUser]);

  const fetchMySubjects = async () => {
    if (!currentUser?.uid) return;

    // 1. Get ALL subjects assigned to THIS teacher
    const res = await getSubjectsByTeacher(currentUser.uid);
    
    if (res.success) {
      // 2. Filter to only show subjects for the CURRENT semester
      const filteredSubjects = res.data.filter(
        (sub) => sub.semesterId === semesterId
      );
      
      setSubjects(filteredSubjects);
      
      // Extract semester name from the first subject found (since semester doc might not be fetched directly)
      if (filteredSubjects.length > 0) {
        setSemesterName(filteredSubjects[0].semesterName);
      }
    }
    setLoading(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/teacher/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {semesterName || 'Semester'}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            View your assigned subjects in this semester.
          </p>
        </div>

        {subjects.length === 0 ? (
          <Card className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No subjects assigned to you in this semester.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {subjects.map((subject) => (
              <Link key={subject.id} to={`/teacher/subject/${subject.id}`}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer h-full active:scale-[0.98]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                      <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                  </div>
                  
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">
                    {subject.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-3">
                    {subject.code}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {subject.classes?.length || 0} Classes
                    </div>
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

export default SemesterDetails;
// src/pages/teacher/SubjectDetails.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ClipboardList, Layers, Edit, Clock, FileSpreadsheet, ChevronRight, Activity } from 'lucide-react';
import { getSubjectById, getStudentsByClass } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const SubjectDetails = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState(null);
  const [studentCounts, setStudentCounts] = useState({});
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [subjectId]);

  const fetchData = async () => {
    const result = await getSubjectById(subjectId);
    if (result.success) {
      setSubject(result.data);
      
      let total = 0;
      const counts = {};
      if (result.data.classes && result.data.classes.length > 0) {
        for (const cls of result.data.classes) {
          const studentsResult = await getStudentsByClass(cls.classId);
          if (studentsResult.success) {
            counts[cls.classId] = studentsResult.data.length;
            total += studentsResult.data.length;
          }
        }
      }
      setStudentCounts(counts);
      setTotalStudents(total);
    } else {
      toast.error('Subject not found');
      navigate('/teacher/dashboard');
    }
    setLoading(false);
  };

  if (loading) return <Loading />;
  if (!subject) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6">
          <Link to={`/teacher/semester/${subject.semesterId}`} className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{subject.name}</h1>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{subject.code}</span>
              </div>
              <p className="text-gray-600 text-sm mt-1">{subject.semesterName}</p>
              {subject.schedule && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> {subject.schedule}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-6">
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs sm:text-sm">Classes</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{subject.classes?.length || 0}</p>
              </div>
              <Layers className="w-8 h-8 sm:w-12 sm:h-12 text-orange-200" />
            </div>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs sm:text-sm">Students</p>
                <p className="text-2xl sm:text-4xl font-bold mt-1">{totalStudents}</p>
              </div>
              <Users className="w-8 h-8 sm:w-12 sm:h-12 text-blue-200" />
            </div>
          </Card>
        </div>

        {/* Assigned Classes */}
        <h2 className="text-lg font-bold text-gray-800 mb-3">Assigned Classes</h2>
        
        {(!subject.classes || subject.classes.length === 0) ? (
          <Card className="text-center py-10 mb-6">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4 text-sm">No classes assigned by Admin yet</p>
          </Card>
        ) : (
          <div className="space-y-3 mb-6">
            {subject.classes.map((cls) => (
              <Card key={cls.classId} className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">{cls.className}</h3>
                      <p className="text-xs text-gray-500">{studentCounts[cls.classId] || 0} students</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 sm:gap-2">
                    <Link to={`/teacher/class/${cls.classId}/students`} className="flex-1 sm:flex-none">
                      <Button size="sm" variant="secondary" icon={Users} className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-3">
                        Students
                      </Button>
                    </Link>

                    <Link to={`/teacher/subject/${subjectId}/class/${cls.classId}/attendance`} className="flex-1 sm:flex-none">
                      <Button size="sm" icon={ClipboardList} className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-3">
                        Attendance
                      </Button>
                    </Link>

                    <Link to={`/teacher/subject/${subjectId}/class/${cls.classId}/sheet`} className="flex-1 sm:flex-none">
                      <Button variant="secondary" size="sm" icon={FileSpreadsheet} className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-3">
                        Sheet
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-gray-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to={`/teacher/subject/${subjectId}/edit-attendance`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer p-4 border-2 border-dashed border-orange-200 hover:border-orange-400 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Edit className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Edit Attendance</h3>
                  <p className="text-xs text-gray-500">Modify records</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </Card>
          </Link>

          <Link to={`/teacher/subject/${subjectId}/activity`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer p-4 border-2 border-dashed border-purple-200 hover:border-purple-400 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">My Activity</h3>
                  <p className="text-xs text-gray-500">View Unit/Topic Logs</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default SubjectDetails;

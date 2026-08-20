// src/pages/teacher/SubjectDetails.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ClipboardList, Layers, Edit, Clock, FileSpreadsheet, ChevronRight, Activity, Calendar, X } from 'lucide-react';
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
  const [showCRModal, setShowCRModal] = useState(false);

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
      
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {/* Header Section */}
        <div className="mb-4">
          <Link 
            to={`/teacher/semester/${subject.semesterId}`} 
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{subject.name}</h1>
                <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md text-xs font-semibold shadow-sm">
                  {subject.code}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1.5 font-medium">{subject.semesterName}</p>
              {subject.schedule && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5" /> {subject.schedule}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs sm:text-sm font-medium mb-1">Total Classes</p>
                <p className="text-3xl sm:text-4xl font-bold text-white">{subject.classes?.length || 0}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs sm:text-sm font-medium mb-1">Total Students</p>
                <p className="text-3xl sm:text-4xl font-bold text-white">{totalStudents}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Classes Section */}
        <div className="mb-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-700" />
            Assigned Classes
          </h2>
          
          {(!subject.classes || subject.classes.length === 0) ? (
            <Card className="text-center py-12">
              <Layers className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No classes assigned by Admin yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {subject.classes.map((cls, index) => {
                const colors = [
                  { border: 'border-orange-300', icon: 'bg-orange-100', iconColor: 'text-orange-600', hover: 'hover:border-orange-500 hover:shadow-md' },
                  { border: 'border-blue-300', icon: 'bg-blue-100', iconColor: 'text-blue-600', hover: 'hover:border-blue-500 hover:shadow-md' },
                  { border: 'border-emerald-300', icon: 'bg-emerald-100', iconColor: 'text-emerald-600', hover: 'hover:border-emerald-500 hover:shadow-md' },
                  { border: 'border-violet-300', icon: 'bg-violet-100', iconColor: 'text-violet-600', hover: 'hover:border-violet-500 hover:shadow-md' },
                  { border: 'border-rose-300', icon: 'bg-rose-100', iconColor: 'text-rose-600', hover: 'hover:border-rose-500 hover:shadow-md' },
                  { border: 'border-cyan-300', icon: 'bg-cyan-100', iconColor: 'text-cyan-600', hover: 'hover:border-cyan-500 hover:shadow-md' },
                ];
                const color = colors[index % colors.length];
                
                return (
                  <div 
                    key={cls.classId} 
                    className={`bg-white rounded-xl border-2 ${color.border} ${color.hover} p-3 sm:p-4 transition-all duration-200`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-11 h-11 sm:w-13 sm:h-13 ${color.icon} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <Layers className={`w-5 h-5 sm:w-6 sm:h-6 ${color.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{cls.className}</h3>
                          <p className="text-xs text-gray-600 font-medium flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3" />
                            {studentCounts[cls.classId] || 0} students
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/teacher/class/${cls.classId}/students`} className="flex-1 sm:flex-none">
                          <Button size="sm" variant="secondary" icon={Users} className="w-full sm:w-auto text-xs sm:text-sm">
                            Students
                          </Button>
                        </Link>

                        <Link to={`/teacher/subject/${subjectId}/class/${cls.classId}/attendance`} className="flex-1 sm:flex-none">
                          <Button size="sm" icon={ClipboardList} className="w-full sm:w-auto text-xs sm:text-sm">
                            Attendance
                          </Button>
                        </Link>

                        <Link to={`/teacher/subject/${subjectId}/class/${cls.classId}/sheet`} className="flex-1 sm:flex-none">
                          <Button variant="secondary" size="sm" icon={FileSpreadsheet} className="w-full sm:w-auto text-xs sm:text-sm">
                            Sheet
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-700" />
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Edit Attendance */}
            <Link to={`/teacher/subject/${subjectId}/edit-attendance`}>
              <div className="bg-white rounded-xl p-4 border-2 border-dashed border-orange-300 hover:border-orange-500 hover:shadow-md transition-all duration-200 cursor-pointer h-full group">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                    <Edit className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">Edit Attendance</h3>
                    <p className="text-xs text-gray-600 mt-0.5">Modify records</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                </div>
              </div>
            </Link>

            {/* CR Attendance Report */}
            <div onClick={() => setShowCRModal(true)} className="cursor-pointer">
              <div className="bg-white rounded-xl p-4 border-2 border-dashed border-cyan-300 hover:border-cyan-500 hover:shadow-md transition-all duration-200 h-full group">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-100 rounded-lg group-hover:bg-cyan-200 transition-colors">
                    <Calendar className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">CR Attendance Report</h3>
                    <p className="text-xs text-gray-600 mt-0.5">View CR-submitted records</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* My Activity */}
            <Link to={`/teacher/subject/${subjectId}/activity`}>
              <div className="bg-white rounded-xl p-4 border-2 border-dashed border-purple-300 hover:border-purple-500 hover:shadow-md transition-all duration-200 cursor-pointer h-full group">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">My Activity</h3>
                    <p className="text-xs text-gray-600 mt-0.5">View unit and topic logs</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* CR Attendance Class Selection Modal */}
      {showCRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Select Class</h2>
                  <p className="text-cyan-100 text-xs">Choose a class to view CR report</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCRModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(85vh-88px)]">
              {(!subject.classes || subject.classes.length === 0) ? (
                <div className="text-center py-10">
                  <Layers className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No classes assigned to this subject yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {subject.classes.map((cls, index) => {
                    const colors = [
                      { border: 'border-orange-300', hover: 'hover:border-orange-500', icon: 'bg-orange-100', iconColor: 'text-orange-600' },
                      { border: 'border-blue-300', hover: 'hover:border-blue-500', icon: 'bg-blue-100', iconColor: 'text-blue-600' },
                      { border: 'border-emerald-300', hover: 'hover:border-emerald-500', icon: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                      { border: 'border-violet-300', hover: 'hover:border-violet-500', icon: 'bg-violet-100', iconColor: 'text-violet-600' },
                      { border: 'border-rose-300', hover: 'hover:border-rose-500', icon: 'bg-rose-100', iconColor: 'text-rose-600' },
                      { border: 'border-cyan-300', hover: 'hover:border-cyan-500', icon: 'bg-cyan-100', iconColor: 'text-cyan-600' },
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div 
                        key={cls.classId} 
                        className={`flex items-center justify-between p-3 bg-white rounded-lg border-2 ${color.border} ${color.hover} hover:shadow-sm transition-all duration-200`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 ${color.icon} rounded-lg flex items-center justify-center shrink-0`}>
                            <Layers className={`w-5 h-5 ${color.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate text-sm">{cls.className}</p>
                            <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3" />
                              {studentCounts[cls.classId] || 0} students
                            </p>
                          </div>
                        </div>
                        <Link to={`/teacher/class/${cls.classId}/cr-attendance-report`} onClick={() => setShowCRModal(false)}>
                          <Button size="sm" icon={Calendar} className="flex-shrink-0">
                            View
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectDetails;
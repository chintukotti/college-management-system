// src/pages/teacher/TakeAttendance.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight, Save, RotateCcw, Clock, Users, BookOpen, FlaskConical, Search, CheckCircle, XCircle, List, Columns } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { getSubjectById, getStudentsByClass, getClassById, saveSessionAttendance, logTeacherActivity } from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';

const TakeAttendance = () => {
  const { subjectId, classId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [subject, setSubject] = useState(null);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [sessionType, setSessionType] = useState('class');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [viewMode, setViewMode] = useState('swipe');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unit, setUnit] = useState('');
  const [topic, setTopic] = useState('');

  const today = getTodayDate();
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', hour12: true 
  });

  const sessionCount = sessionType === 'lab' ? 3 : 1;

  useEffect(() => { fetchData(); }, [subjectId, classId]);

  const fetchData = async () => {
    const [subjectResult, classResult, studentsResult] = await Promise.all([
      getSubjectById(subjectId),
      getClassById(classId),
      getStudentsByClass(classId)
    ]);

    if (!subjectResult.success) {
      toast.error('Subject not found');
      navigate('/teacher/dashboard');
      return;
    }

    setSubject(subjectResult.data);
    if (classResult.success) setClassData(classResult.data);
    if (studentsResult.success) setStudents(studentsResult.data);
    setLoading(false);
  };

  const updateAttendanceRecord = (student, status) => {
    setAttendance(prev => ({
      ...prev,
      [student.id]: {
        oderId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        classId: classId,
        className: classData?.name,
        status,
        sessionType,
        count: sessionCount
      }
    }));
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipeMark('present'),
    onSwipedRight: () => handleSwipeMark('absent'),
    preventScrollOnSwipe: true,
    trackMouse: true,
    trackTouch: true,
    delta: 50
  });

  const handleSwipeMark = (status) => {
    if (currentIndex >= students.length) return;
    const student = students[currentIndex];
    setSwipeDirection(status);
    updateAttendanceRecord(student, status);

    setTimeout(() => {
      setSwipeDirection(null);
      if (currentIndex < students.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }, 300);
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !swipeDirection) setCurrentIndex(prev => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < students.length - 1 && !swipeDirection) setCurrentIndex(prev => prev + 1);
  };

  const handleListMark = (student, status) => { updateAttendanceRecord(student, status); };

  const handleMarkAll = (status) => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = {
        oderId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        classId: classId,
        className: classData?.name,
        status: status,
        sessionType: sessionType,
        count: sessionCount
      };
    });
    setAttendance(newAttendance);
    toast.success(`All students marked as ${status}`);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReset = () => { setAttendance({}); setCurrentIndex(0); };

  const handleSave = async () => {
    if (!unit.trim()) {
      toast.error('Unit is mandatory');
      return;
    }
    if (Object.keys(attendance).length < students.length) {
      toast.error(`Mark all students first (${Object.keys(attendance).length}/${students.length})`);
      return;
    }

    setSaving(true);

    try {
      const attendanceTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // One batched write for the whole class instead of two writes per
      // student, and the class attendance rollup is updated in the same call.
      const result = await saveSessionAttendance({
        subjectId,
        classId,
        date: today,
        records: Object.values(attendance).map(record => ({
          oderId: record.oderId,
          studentId: record.studentId,
          studentName: record.studentName,
          status: record.status,
          // Derive from the CURRENT session type, not the value captured when
          // the student was marked. Toggling Class/Lab after marking some
          // students left those records with the old count while maxCount came
          // from the final toggle — a fully-present student then rolled up as
          // 1-of-3 (or 3-of-1).
          count: sessionCount,
          maxCount: sessionCount,
          sessionType
        })),
        meta: {
          subjectName: subject.name,
          subjectCode: subject.code,
          semesterId: subject.semesterId,
          semesterName: subject.semesterName,
          className: classData?.name,
          time: attendanceTime,
          sessionType,
          markedBy: currentUser.uid,
          teacherName: currentUser.name, //Added
          unit,
          topic
        }
      });

      if (!result.success) throw new Error(result.error || 'Failed to save attendance');

        if (unit || topic) {
          await logTeacherActivity({
              teacherId: currentUser.uid,
              teacherName: currentUser.name,
              subjectId, subjectName: subject.name,
              classId, className: classData?.name,
              date: today, unit: unit, topic: topic
          });
        }

        toast.success(`Attendance saved! (${sessionType === 'lab' ? 'Lab - 3 counts' : 'Class - 1 count'})`);
        navigate(`/teacher/subject/${subjectId}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save attendance');
    }

    setSaving(false);
  };

  const getAttendanceStats = () => {
    const records = Object.values(attendance);
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    return { present, absent, total: students.length };
  };

  if (loading) return <Loading />;

  const stats = getAttendanceStats();
  const currentStudent = students[currentIndex];
  const currentStudentAttendance = attendance[currentStudent?.id];

  const isSaveEnabled = unit.trim() && Object.keys(attendance).length >= students.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-lg mx-auto px-4 py-4">
        <Link to={`/teacher/subject/${subjectId}`} className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-3 text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-lg font-bold text-gray-800">Take Attendance</h1>
                <p className="text-gray-600 text-xs">{subject?.name} • {classData?.name}</p>
                <p className="text-gray-400 text-xs mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />{currentTime}
                </p>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('swipe')}
                    className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${viewMode === 'swipe' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    <Columns className="w-4 h-4" /> 
                </button>
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    <List className="w-4 h-4" /> 
                </button>
            </div>
        </div>

        {/* ✅ COMPACT Unit and Topic Card */}
        <Card className="mb-3 p-2.5 border border-blue-100 bg-blue-50/50">
            <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g., Unit 1"
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {!unit.trim() && (
                    <p className="text-[10px] text-red-400 mt-0.5">Required</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Topic Covered
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Intro"
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
            </div>
        </Card>

        {/* Session Type — Compact inline */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setSessionType('class')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border-2 transition-all ${
              sessionType === 'class'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="font-medium text-sm">Class</span>
            <span className="text-xs opacity-60">(×1)</span>
          </button>
          <button
            onClick={() => setSessionType('lab')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border-2 transition-all ${
              sessionType === 'lab'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span className="font-medium text-sm">Lab</span>
            <span className="text-xs opacity-60">(×3)</span>
          </button>
        </div>

        {/* Progress */}
        <Card className="mb-3 p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Progress</span>
            <span className="text-xs font-medium">
              {Object.keys(attendance).length} / {students.length}
              {Object.keys(attendance).length >= students.length && (
                <span className="ml-1 text-green-500">✓</span>
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                Object.keys(attendance).length >= students.length ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${(Object.keys(attendance).length / Math.max(students.length, 1)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-green-600 font-medium">✓ Present: {stats.present}</span>
            <span className="text-red-600 font-medium">✗ Absent: {stats.absent}</span>
          </div>
        </Card>

        {/* ----- SWIPE MODE (ORIGINAL) ----- */}
        {viewMode === 'swipe' && (
          <>
            <div className="flex items-center justify-center gap-4 text-xs mb-3 text-gray-500">
              <span className="flex items-center gap-1">
                <ChevronLeft className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Present</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <span className="text-red-600">Absent</span>
                <ChevronRight className="w-4 h-4 text-red-500" />
              </span>
            </div>

            {students.length > 0 && currentIndex < students.length ? (
              <div className="mb-4 relative overflow-hidden">
                <div
                  {...handlers}
                  className={`
                    bg-white rounded-xl shadow-lg p-6 text-center cursor-grab active:cursor-grabbing select-none
                    transition-all duration-300 ease-out
                    ${swipeDirection === 'present' ? '-translate-x-full opacity-0 rotate-[-10deg]' : ''}
                    ${swipeDirection === 'absent' ? 'translate-x-full opacity-0 rotate-[10deg]' : ''}
                    ${!swipeDirection ? 'translate-x-0 opacity-100 rotate-0' : ''}
                  `}
                  style={{ touchAction: 'pan-y' }}
                >
                  {/* Status Badge */}
                  {currentStudentAttendance && (
                    <div className={`
                      absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium
                      ${currentStudentAttendance.status === 'present' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'}
                    `}>
                      {currentStudentAttendance.status === 'present' ? '✓ P' : '✗ A'}
                    </div>
                  )}

                  {/* Session Badge */}
                  <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium ${
                    sessionType === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {sessionType === 'lab' ? 'Lab (×3)' : 'Class (×1)'}
                  </div>

                  {/* Swipe Indicators */}
                  <div className="flex justify-between items-center absolute inset-x-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className={`w-10 h-10 rounded-full bg-green-100 flex items-center justify-center transition-opacity ${
                      swipeDirection === 'present' ? 'opacity-100' : 'opacity-30'
                    }`}>
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                    <div className={`w-10 h-10 rounded-full bg-red-100 flex items-center justify-center transition-opacity ${
                      swipeDirection === 'absent' ? 'opacity-100' : 'opacity-30'
                    }`}>
                      <X className="w-5 h-5 text-red-500" />
                    </div>
                  </div>

                  {/* Student Avatar */}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    sessionType === 'lab' 
                      ? 'bg-gradient-to-br from-purple-400 to-purple-600' 
                      : 'bg-gradient-to-br from-blue-400 to-blue-600'
                  }`}>
                    <span className="text-white text-2xl font-bold">
                      {currentStudent?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Student Info */}
                  <h2 className="text-lg font-bold text-gray-800 mb-1">{currentStudent?.name}</h2>
                  <p className="text-gray-500 text-sm mb-1">{currentStudent?.studentId}</p>
                  <p className="text-gray-400 text-xs">{currentIndex + 1} of {students.length}</p>
                </div>

                {/* Manual Buttons */}
                <div className="flex justify-center gap-3 mt-4">
                  <Button
                    variant="success"
                    onClick={() => !swipeDirection && handleSwipeMark('present')}
                    icon={Check}
                    className="flex-1 max-w-[120px]"
                    disabled={!!swipeDirection}
                  >
                    Present
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => !swipeDirection && handleSwipeMark('absent')}
                    icon={X}
                    className="flex-1 max-w-[120px]"
                    disabled={!!swipeDirection}
                  >
                    Absent
                  </Button>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-3">
                  <Button variant="secondary" size="sm" onClick={handlePrevious} disabled={currentIndex === 0 || !!swipeDirection}>
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleNext} disabled={currentIndex === students.length - 1 || !!swipeDirection}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : students.length === 0 ? (
              <Card className="text-center py-8">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No students</p>
              </Card>
            ) : null}
          </>
        )}

        {/* ----- LIST MODE WITH SERIAL NUMBERS ----- */}
        {viewMode === 'list' && (
          <>
            <Card className="mb-3 p-3">
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search name or ID..." 
                    className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="success" size="sm" className="flex-1" onClick={() => handleMarkAll('present')}>
                    <CheckCircle className="w-4 h-4 mr-1" /> All Present
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => handleMarkAll('absent')}>
                    <XCircle className="w-4 h-4 mr-1" /> All Absent
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-2 mb-20 max-h-[400px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <Card className="text-center py-4">
                  <p className="text-gray-500 text-sm">No students found</p>
                </Card>
              ) : (
                filteredStudents.map((student, index) => {
                  const status = attendance[student.id]?.status;
                  return (
                    <Card key={student.id} className={`p-3 flex items-center justify-between transition-colors ${
                      status === 'present' ? 'bg-green-50 border-green-200' :
                      status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-3">
                        {/* ✅ Serial Number */}
                        <div className="text-gray-400 font-medium text-sm w-6 text-right">
                          {index + 1}.
                        </div>
                        
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          status === 'present' ? 'bg-green-500' :
                          status === 'absent' ? 'bg-red-500' :
                          'bg-gray-300'
                        }`}>
                          {status === 'present' ? <Check className="w-5 h-5"/> : 
                           status === 'absent' ? <X className="w-5 h-5"/> :
                           student.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                          <p className="text-gray-500 text-xs">{student.studentId}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant={status === 'present' ? 'success' : 'secondary'} 
                          onClick={() => handleListMark(student, 'present')} 
                          className="px-3"
                        >
                          P
                        </Button>
                        <Button 
                          size="sm" 
                          variant={status === 'absent' ? 'danger' : 'secondary'} 
                          onClick={() => handleListMark(student, 'absent')} 
                          className="px-3"
                        >
                          A
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleReset} icon={RotateCcw} size="sm" className="flex-1">
            Reset
          </Button>
          <Button 
            onClick={handleSave} 
            loading={saving} 
            disabled={!isSaveEnabled} 
            icon={Save} 
            size="sm" 
            className="flex-1"
          >
            Save ({Object.keys(attendance).length}/{students.length})
          </Button>
        </div>

        {!isSaveEnabled && (
          <div className="mt-2 text-center">
            <p className="text-[11px] text-gray-400">
              {!unit.trim() && Object.keys(attendance).length < students.length
                ? `Enter Unit & mark all students (${Object.keys(attendance).length}/${students.length})`
                : !unit.trim()
                  ? 'Enter Unit to enable save'
                  : `Mark all students (${Object.keys(attendance).length}/${students.length})`
              }
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TakeAttendance;
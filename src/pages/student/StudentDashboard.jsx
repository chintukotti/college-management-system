import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, CheckCircle, XCircle, Clock, Users, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjectsForStudent, getAttendanceForStudent } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import toast from 'react-hot-toast';

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentSemester, setStudentSemester] = useState(null);
  const [crInfo, setCrInfo] = useState(null);

  useEffect(() => {
    checkCRStatus();
  }, []);

  useEffect(() => { fetchData(); }, [currentUser]);

  const checkCRStatus = async () => {
    if(currentUser?.uid) {
        const { checkIfCR } = require('../../firebase/services');
        const res = await checkIfCR(currentUser.uid);
        if(res.success && res.isCR) setCrInfo(res.classData);
    }
  };

  const fetchData = useCallback(async (force = false) => {
    if (!currentUser?.uid || !currentUser?.classId) {
      setLoading(false);
      return;
    }

    try {
      const [subjectsResult, attendanceResult] = await Promise.all([
        getSubjectsForStudent(currentUser.classId, force),
        getAttendanceForStudent(currentUser.uid, { force })
      ]);

      if (subjectsResult.success) {
        setSubjects(subjectsResult.data);
        
        if (subjectsResult.data.length > 0) {
          const firstSubject = subjectsResult.data[0];
          setStudentSemester({ 
            id: firstSubject.semesterId, 
            name: firstSubject.semesterName || firstSubject.semesterId || 'Semester'
          });
        } else if(currentUser.semesterId) {
          setStudentSemester({ id: currentUser.semesterId, name: currentUser.semesterName || currentUser.semesterId || 'Semester' });
        }
      }

      if (attendanceResult.success) setAttendance(attendanceResult.data);
    } catch (error) {
       console.error("Error fetching data:", error);
       toast.error("Failed to load data");
    } finally {
       setLoading(false);
    }
  }, [currentUser]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchData(true);
    toast.success('Data refreshed!');
  };
  
  const targetSemesterId = studentSemester?.id || 'none';
  const filteredSubjects = subjects.filter(s => s.semesterId === targetSemesterId);
  const filteredAttendance = attendance.filter(a => a.semesterId === targetSemesterId);

  // ✅ FIXED: Uses pre-computed stats if available, falls back to calculating from records
  const getSubjectStats = (subject) => {
    const subAtt = filteredAttendance.filter(a => a.subjectId === subject.id);
    
    if (subAtt.length === 0) {
      return { grandTotal: 0, presentCount: 0, percentage: 0 };
    }
    
    const capacities = subject.dateCapacities?.[currentUser.classId] || {};
    const studentDates = [...new Set(subAtt.map(a => a.date))];
    let grandTotal = 0;
    
    studentDates.forEach(date => {
      if (capacities[date]) {
        grandTotal += capacities[date];
      } else {
        const rec = subAtt.find(a => a.date === date);
        grandTotal += (rec?.maxCount || rec?.count || 1);
      }
    });
    
    let presentCount = 0;
    subAtt.forEach(a => { if (a.status === 'present') presentCount += (a.count || 1); });
    
    const percentage = grandTotal > 0 ? Math.round((presentCount / grandTotal) * 100) : 0;
    
    return { grandTotal, presentCount, percentage };
  };

  // Both halves of the overall figure come from the SAME per-subject stats.
  // Previously the total was summed over the student's subjects while the
  // present count was summed over their attendance records, so any record
  // belonging to a subject no longer on their list (unassigned, deleted) was
  // counted in the numerator but not the denominator — which could push the
  // headline percentage past 100%.
  const overallTotals = () =>
    filteredSubjects.reduce(
      (acc, subject) => {
        const stats = getSubjectStats(subject);
        acc.total += stats.grandTotal;
        acc.present += stats.presentCount;
        return acc;
      },
      { total: 0, present: 0 }
    );

  const getTotalClasses = () => overallTotals().total;

  const getPresentClasses = () => overallTotals().present;

  const calculateOverallAttendance = () => {
    const { total, present } = overallTotals();
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const getRecentAttendance = () => filteredAttendance.slice(0, 5);
  const overallPercentage = calculateOverallAttendance();

  const DashboardSkeleton = () => (
    <div className="animate-pulse">
      <div className="flex justify-between mb-6"><div><Skeleton width="250px" height="24px" className="mb-2" /><Skeleton width="150px" height="16px" /></div><div className="flex gap-2"><Skeleton width="80px" height="36px" className="rounded-lg" /></div></div>
      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6"><Skeleton variant="rectangular" height="100px" className="rounded-xl" /><Skeleton variant="rectangular" height="100px" className="rounded-xl" /><Skeleton variant="rectangular" height="100px" className="rounded-xl" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card><Skeleton count={3} height="60px" className="rounded-lg mb-2" /></Card><Card><Skeleton count={3} height="80px" className="rounded-lg mb-2" /></Card></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        {loading ? (<DashboardSkeleton />) : (
          <>
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome, {currentUser?.name || 'Student'}! 👋</h1>
                    <p className="text-gray-600 mt-1 text-sm">
                        {studentSemester ? studentSemester.name : 'No Semester Assigned'} • {currentUser?.className} • {currentUser?.studentId}
                    </p>
                </div>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefresh} className="self-start">
                    Refresh
                </Button>
            </div>

            {crInfo && (
                <Card className="mb-6 bg-indigo-50 border-indigo-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h3 className="font-bold text-indigo-800">Class Representative Panel</h3>
                            <p className="text-sm text-indigo-600">You are a CR for {crInfo.name}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Link to={`/student/class-report/${crInfo.id}`}>
                                <Button size="sm" variant="secondary" icon={ClipboardList}>Att. Report</Button>
                            </Link>
                            <Link to="/student/take-attendance">
                                <Button size="sm" icon={Users}>Take Attendance</Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4"><div className="text-center"><p className="text-blue-100 text-xs sm:text-sm">Subjects</p><p className="text-2xl sm:text-4xl font-bold mt-1">{filteredSubjects.length}</p></div></Card>
              <Card className={`bg-gradient-to-r ${overallPercentage >= 75 ? 'from-green-500 to-green-600' : overallPercentage >= 50 ? 'from-yellow-500 to-yellow-600' : 'from-red-500 to-red-600'} text-white p-4`}><div className="text-center"><p className="text-white/80 text-xs sm:text-sm">Attendance</p><p className="text-2xl sm:text-4xl font-bold mt-1">{overallPercentage}%</p></div></Card>
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4"><div className="text-center"><p className="text-purple-100 text-xs sm:text-sm">Classes</p><p className="text-2xl sm:text-4xl font-bold mt-1">{getPresentClasses()}/{getTotalClasses()}</p></div></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Recent Attendance" icon={ClipboardList}>
                {getRecentAttendance().length === 0 ? (<div className="text-center py-6"><ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">No attendance records yet</p></div>) : (
                  <div className="space-y-2">
                    {getRecentAttendance().map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {record.status === 'present' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                          <div className="min-w-0"><p className="font-medium text-gray-800 text-sm truncate">{record.subjectName}</p><div className="flex items-center gap-2 text-xs text-gray-500"><span>{new Date(record.date).toLocaleDateString()}</span>{record.time && <><span>•</span><Clock className="w-3 h-3" /><span>{record.time}</span></>}</div></div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{record.status === 'present' ? 'P' : 'A'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/student/attendance"><button className="w-full mt-4 text-blue-600 hover:text-blue-700 font-medium text-center text-sm">View All →</button></Link>
              </Card>

              <Card title="My Subjects" icon={BookOpen}>
                 {filteredSubjects.length === 0 ? (<div className="text-center py-6"><BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">No subjects found for your semester</p></div>) : (
                  <div className="space-y-3">
                    {filteredSubjects.map((subject) => {
                      const stats = getSubjectStats(subject);
                      return (
                        <div key={subject.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium text-gray-800 text-sm">{subject.name}</h4>
                              <p className="text-xs text-gray-500">
                                {subject.code} • {subject.teacherName} • {stats.presentCount}/{stats.grandTotal}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${stats.percentage >= 75 ? 'bg-green-100 text-green-700' : stats.percentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {stats.percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${stats.percentage >= 75 ? 'bg-green-500' : stats.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(stats.percentage, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
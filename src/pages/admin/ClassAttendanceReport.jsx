import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Smartphone, History, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getStudentsByClass, getClassAttendance, getClassById, getCRAttendanceLogs } from '../../firebase/services';
import { createCRAttendanceExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ClassAttendanceReport = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showLogsModal, setShowLogsModal] = useState(false);
  const [crLogs, setCrLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedDates, setExpandedDates] = useState({}); 

  const isStudent = currentUser?.role === 'student';
  const isTeacher = currentUser?.role === 'teacher';
  const isAdmin = currentUser?.role === 'admin'; 
  const backLink = isStudent ? '/student/dashboard' : (isTeacher || isAdmin) ? -1 : '/admin/classes';

  useEffect(() => { fetchData(); }, [classId]);

  const fetchData = async () => {
    const [stuRes, logRes, classRes] = await Promise.all([
      getStudentsByClass(classId),
      getClassAttendance(classId),
      getClassById(classId)
    ]);
    if (stuRes.success) setStudents(stuRes.data);
    if (logRes.success) setLogs(logRes.data);
    if (classRes.success) setClassData(classRes.data);
    setLoading(false);
  };

  const handleShowLogs = async () => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const res = await getCRAttendanceLogs(classId);
      if (res.success) {
        setCrLogs(res.data);
        // Only expand the latest date (first in the array)
        if (res.data.length > 0) {
          const latestDate = res.data[0].editedAt?.toDate ? res.data[0].editedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
          if (latestDate) {
            setExpandedDates({ [latestDate]: true });
          }
        }
      } else {
        toast.error("Failed to load logs");
      }
    } catch (err) {
      toast.error("Error loading logs");
    }
    setLoadingLogs(false);
  };

  const toggleDate = (dateStr) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const handleExport = () => {
    if (logs.length === 0) { toast.error("No attendance to export"); return; }
    createCRAttendanceExcel(students, logs);
    toast.success("Excel Downloaded");
  };

  const getUniqueDates = () => [...new Set(logs.map(l => l.date))].sort();
  const getStatus = (studentId, date) => {
    const log = logs.find(l => l.date === date);
    if (!log) return '-';
    const rec = log.records.find(r => r.studentId === studentId);
    return rec ? (rec.status === 'present' ? 'P' : 'A') : '-';
  };
  const getTotal = (studentId) => {
    let present = 0;
    const dates = getUniqueDates();
    dates.forEach(d => { if (getStatus(studentId, d) === 'P') present++; });
    return { present, total: dates.length };
  };
  const getPercentage = (studentId) => {
    const { present, total } = getTotal(studentId);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };
  const getLatestDateStatus = (studentId) => {
    const dates = getUniqueDates();
    if (dates.length === 0) return '-';
    const latestDate = dates[dates.length - 1];
    return getStatus(studentId, latestDate);
  };

  const getStudentDetails = (studentId) => {
    const index = students.findIndex(stu => stu.id === studentId);
    const s = students[index];
    if (!s) return { rollNo: '-', idNo: '-', name: 'Unknown Student' };
    return {
      rollNo: index + 1,
      idNo: s.studentId,
      name: s.name
    };
  };

  const groupedLogs = useMemo(() => {
    const groups = {};
    crLogs.forEach(log => {
      const dateStr = log.editedAt?.toDate ? log.editedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(log);
    });
    return Object.entries(groups);
  }, [crLogs]);

  if (loading) return <Loading />;
  const dates = getUniqueDates();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-full px-4 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <Link to={backLink} className="inline-flex items-center text-gray-600 mb-2 text-sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">CR Attendance Report</h1>
              <p className="text-gray-600 text-sm">
                {classData?.name || 'Loading...'} • Attendance taken by CRs
                {isStudent && <span className="ml-2 text-indigo-600 font-medium">(CR View)</span>}
                {(isTeacher || isAdmin) && <span className="ml-2 text-blue-600 font-medium">(Staff View)</span>}
              </p>
            </div>
            
            {/* Buttons - Left/Right on Mobile */}
            <div className="flex justify-between sm:justify-end w-full sm:w-auto gap-2">
              {(isTeacher || isAdmin) && (
                <Button variant="secondary" size="sm" icon={History} onClick={handleShowLogs}>
                  Logs
                </Button>
              )}
              <Button icon={Download} size="sm" onClick={handleExport}>Export</Button>
            </div>
          </div>

          {/* Quick Stats */}
          {logs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card className="bg-blue-50 p-3 sm:p-4 text-center">
                <p className="text-xs text-blue-600">Total Days</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-800">{dates.length}</p>
              </Card>
              <Card className="bg-green-50 p-3 sm:p-4 text-center">
                <p className="text-xs text-green-600">Total Students</p>
                <p className="text-xl sm:text-2xl font-bold text-green-800">{students.length}</p>
              </Card>
              <Card className="bg-purple-50 p-3 sm:p-4 text-center">
                <p className="text-xs text-purple-600">Latest Date</p>
                <p className="text-sm sm:text-lg font-bold text-purple-800">{latestDate || '-'}</p>
              </Card>
              <Card className="bg-orange-50 p-3 sm:p-4 text-center">
                <p className="text-xs text-orange-600">{'< 75%'}</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-800">
                  {students.filter(s => getPercentage(s.id) < 75 && dates.length > 0).length}
                </p>
              </Card>
            </div>
          )}

          {logs.length === 0 ? (
            <Card className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No attendance records found.</p>
              {isStudent && (
                <p className="text-gray-400 text-sm mt-2">Start by taking attendance from the CR panel.</p>
              )}
            </Card>
          ) : (
            <>
              {/* MOBILE VIEW */}
              <div className="block md:hidden">
                <Card className="overflow-hidden p-0">
                  <div className="bg-indigo-50 px-4 py-2 border-b flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs text-indigo-600">Showing summary view • Export Excel for full report</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600 w-10">S.No</th>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600">ID</th>
                          <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600"><div>{latestDate}</div><div className="text-[10px] text-gray-400 font-normal">(Latest)</div></th>
                          <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          const latestStatus = getLatestDateStatus(stu.id);
                          return (
                            <tr key={stu.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2.5 text-gray-500 text-xs">{index + 1}</td>
                              <td className="px-3 py-2.5"><p className="font-medium text-gray-800 text-xs">{stu.studentId}</p><p className="text-[11px] text-gray-400 truncate max-w-[120px]">{stu.name}</p></td>
                              <td className="px-3 py-2.5 text-center"><span className={`inline-block w-7 h-7 leading-7 rounded-full text-xs font-bold ${latestStatus === 'P' ? 'bg-green-100 text-green-700' : latestStatus === 'A' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>{latestStatus}</span></td>
                              <td className="px-3 py-2.5 text-center"><span className="text-xs font-bold text-blue-700">{present}/{total}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* DESKTOP VIEW */}
              <div className="hidden md:block">
                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-100 text-gray-700 font-semibold">
                        <tr>
                          <th className="p-3 border-b sticky left-0 bg-gray-100 z-20 w-12 text-center">S.No</th>
                          <th className="p-3 border-b sticky left-12 bg-gray-100 z-20 w-28 min-w-[112px]">ID</th>
                          <th className="p-3 border-b sticky left-40 bg-gray-100 z-20 w-44 min-w-[176px]">Name</th>
                          {dates.map(d => (<th key={d} className="p-3 border-b text-center min-w-[90px]">{d}</th>))}
                          <th className="p-3 border-b text-center bg-blue-50 sticky right-16 z-20 min-w-[70px] border-l">Total</th>
                          <th className="p-3 border-b text-center bg-blue-50 sticky right-0 z-20 min-w-[60px] border-l">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          const pct = getPercentage(stu.id);
                          return (
                            <tr key={stu.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-center text-gray-500 sticky left-0 bg-white z-10 border-r">{index + 1}</td>
                              <td className="p-3 font-medium text-gray-900 sticky left-12 bg-white z-10">{stu.studentId}</td>
                              <td className="p-3 text-gray-700 sticky left-40 bg-white z-10 border-r">{stu.name}</td>
                              {dates.map(d => (
                                <td key={d} className="p-3 text-center">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatus(stu.id, d) === 'P' ? 'bg-green-100 text-green-700' : getStatus(stu.id, d) === 'A' ? 'bg-red-100 text-red-700' : 'text-gray-400'}`}>{getStatus(stu.id, d)}</span>
                                </td>
                              ))}
                              <td className="p-3 text-center font-bold text-blue-700 bg-blue-50 sticky right-16 z-10 border-l">{present}/{total}</td>
                              <td className={`p-3 text-center font-bold bg-blue-50 sticky right-0 z-10 border-l ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Simple CR Edit Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="bg-blue-600 px-4 py-3 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white">CR Edit Logs</h2>
                  <p className="text-blue-100 text-xs">{classData?.name}</p>
                </div>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : groupedLogs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No edit logs found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupedLogs.map(([dateStr, dateLogs]) => {
                    const isExpanded = expandedDates[dateStr] === true; 
                    return (
                      <div key={dateStr} className="border rounded-lg overflow-hidden">
                        {/* Date Header */}
                        <button 
                          onClick={() => toggleDate(dateStr)}
                          className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-800">{dateStr}</span>
                            <span className="text-xs text-gray-500">({dateLogs.length})</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {/* Logs */}
                        {isExpanded && (
                          <div className="border-t">
                            {dateLogs.map((log) => (
                              <div key={log.id} className="p-3 border-b last:border-b-0 space-y-2">
                                {/* Time & CR */}
                                <div className="flex justify-between text-xs mb-2">
                                  <span className="text-gray-500">
                                    {log.editedAt?.toDate ? log.editedAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </span>
                                  <span className="font-semibold text-indigo-600">
                                    By: {log.editorName || 'Unknown CR'}
                                  </span>
                                </div>

                                {/* Changes */}
                                {log.changedStudents.map((change, idx) => {
                                  const details = getStudentDetails(change.studentId);
                                  return (
                                    <div key={idx} className="bg-gray-50 p-2 rounded flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-gray-800 truncate">
                                          {details.rollNo}. {details.name}
                                        </div>
                                        <div className="text-xs text-gray-500">{details.idNo}</div>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                                        <span className={`px-2 py-0.5 rounded ${change.oldStatus === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {change.oldStatus === 'present' ? 'P' : 'A'}
                                        </span>
                                        <span>→</span>
                                        <span className={`px-2 py-0.5 rounded ${change.newStatus === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {change.newStatus === 'present' ? 'P' : 'A'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
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

export default ClassAttendanceReport;
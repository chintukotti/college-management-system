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
        if (res.data.length > 0) {
          const latestDate = res.data[0].editedAt?.toDate ? res.data[0].editedAt.toDate().toLocaleDateString() : null;
          if (latestDate) setExpandedDates({ [latestDate]: true });
        }
      } else { toast.error("Failed to load logs"); }
    } catch (err) { toast.error("Error loading logs"); }
    setLoadingLogs(false);
  };

  const toggleDate = (dateStr) => setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));

  const handleExport = () => {
    if (logs.length === 0) { toast.error("No attendance to export"); return; }
    createCRAttendanceExcel(students, logs);
    toast.success("Excel Downloaded");
  };

  // ✅ NEW: Flatten logs into a single sorted array for perfect column alignment
  const allColumns = useMemo(() => {
    return [...logs].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });
  }, [logs]);

  // ✅ NEW: Group by Date for the top header row
  const dateHeaders = useMemo(() => {
    const groups = [];
    allColumns.forEach(col => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === col.date) {
        lastGroup.span++;
      } else {
        groups.push({ date: col.date, span: 1 });
      }
    });
    return groups;
  }, [allColumns]);

  const getStatus = (studentId, log) => {
    const rec = log.records.find(r => r.studentId === studentId);
    return rec ? (rec.status === 'present' ? 'P' : 'A') : '-';
  };

  const getTotal = (studentId) => {
    let present = 0;
    let total = 0;
    allColumns.forEach(log => {
      total++;
      if (getStatus(studentId, log) === 'P') present++;
    });
    return { present, total };
  };

  const getPercentage = (studentId) => {
    const { present, total } = getTotal(studentId);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const getStudentDetails = (studentId) => {
    const index = students.findIndex(stu => stu.id === studentId);
    const s = students[index];
    if (!s) return { rollNo: '-', idNo: '-', name: 'Unknown Student' };
    return { rollNo: index + 1, idNo: s.studentId, name: s.name };
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
  
  const latestDate = allColumns.length > 0 ? allColumns[allColumns.length - 1].date : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-full px-4 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
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
            <div className="flex gap-2">
              {(isTeacher || isAdmin) && (
                <Button variant="secondary" size="sm" icon={History} onClick={handleShowLogs}>Logs</Button>
              )}
              <Button icon={Download} size="sm" onClick={handleExport}>Export Excel</Button>
            </div>
          </div>

          {logs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card className="bg-blue-50 p-3 sm:p-4 text-center">
                <p className="text-xs text-blue-600">Total Sessions</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-800">{logs.length}</p>
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
                  {students.filter(s => getPercentage(s.id) < 75 && logs.length > 0).length}
                </p>
              </Card>
            </div>
          )}

          {logs.length === 0 ? (
            <Card className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No attendance records found.</p>
            </Card>
          ) : (
            <>
              {/* MOBILE VIEW */}
              <div className="block md:hidden">
                <Card className="overflow-hidden p-0">
                  <div className="bg-indigo-50 px-4 py-2 border-b">
                    <p className="text-xs text-indigo-600">Showing summary view • Export Excel for full report</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600 w-10">S.No</th>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600">ID & Name</th>
                          <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600">Total P/A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          return (
                            <tr key={stu.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2.5 text-gray-500 text-xs">{index + 1}</td>
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-gray-800 text-xs">{stu.studentId}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{stu.name}</p>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-xs font-bold text-blue-700">{present}/{total}</span>
                              </td>
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
                    <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                      <thead className="bg-gray-100 text-gray-700 font-semibold">
                        {/* ✅ FIXED: Multi-row header with proper borders and center alignment */}
                        <tr>
                          <th rowSpan={2} className="p-3 border border-gray-300 sticky left-0 bg-gray-100 z-20 w-12 text-center align-middle">S.No</th>
                          <th rowSpan={2} className="p-3 border border-gray-300 sticky left-12 bg-gray-100 z-20 w-28 min-w-[112px] text-center align-middle">ID</th>
                          <th rowSpan={2} className="p-3 border border-gray-300 sticky left-40 bg-gray-100 z-20 w-44 min-w-[176px] text-center align-middle">Name</th>
                          {dateHeaders.map(dh => (
                            <th key={dh.date} colSpan={dh.span} className="p-3 border border-gray-300 text-center min-w-[90px]">{dh.date}</th>
                          ))}
                          <th rowSpan={2} className="p-3 border border-gray-300 text-center bg-blue-50 sticky right-16 z-20 min-w-[70px] align-middle">Total</th>
                          <th rowSpan={2} className="p-3 border border-gray-300 text-center bg-blue-50 sticky right-0 z-20 min-w-[60px] align-middle">%</th>
                        </tr>
                        <tr>
                          {allColumns.map(col => (
                            <th key={col.id} className="p-2 border border-gray-300 text-center min-w-[90px] text-xs font-normal text-gray-600 bg-gray-50">{col.subjectName || 'N/A'}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          const pct = getPercentage(stu.id);
                          return (
                            <tr key={stu.id} className="hover:bg-gray-50">
                              <td className="p-3 text-center text-gray-500 border border-gray-300 sticky left-0 bg-white z-10 align-middle">{index + 1}</td>
                              <td className="p-3 font-medium text-gray-900 border border-gray-300 sticky left-12 bg-white z-10 text-center align-middle">{stu.studentId}</td>
                              <td className="p-3 text-gray-700 border border-gray-300 sticky left-40 bg-white z-10 text-left align-middle">{stu.name}</td>
                              {allColumns.map(col => (
                                <td key={col.id} className="p-3 text-center border border-gray-300 align-middle">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatus(stu.id, col) === 'P' ? 'bg-green-100 text-green-700' : getStatus(stu.id, col) === 'A' ? 'bg-red-100 text-red-700' : 'text-gray-400'}`}>
                                    {getStatus(stu.id, col)}
                                  </span>
                                </td>
                              ))}
                              <td className="p-3 text-center font-bold text-blue-700 bg-blue-50 border border-gray-300 sticky right-16 z-10 align-middle">{present}/{total}</td>
                              <td className={`p-3 text-center font-bold bg-blue-50 border border-gray-300 sticky right-0 z-10 align-middle ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</td>
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

      {/* CR Edit Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">CR Edit Logs</h2>
                  <p className="text-blue-100 text-xs">{classData?.name}</p>
                </div>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : groupedLogs.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No edit logs found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedLogs.map(([dateStr, dateLogs]) => {
                    const isExpanded = expandedDates[dateStr] !== false; 
                    return (
                      <div key={dateStr} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button 
                          onClick={() => toggleDate(dateStr)}
                          className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${isExpanded ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-bold text-gray-800">{dateStr}</span>
                            <span className="text-xs text-gray-500">({dateLogs.length} edit{dateLogs.length > 1 ? 's' : ''})</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>

                        {isExpanded && (
                          <div className="divide-y divide-gray-100 border-t border-gray-100">
                            {dateLogs.map((log) => (
                              <div key={log.id} className="p-4 space-y-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs text-gray-500 font-medium">
                                    {log.editedAt?.toDate ? log.editedAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown Time'}
                                    <span className="ml-2 text-indigo-600 font-bold">({log.subjectName || 'Unknown'})</span>
                                  </span>
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    By: {log.editorName || 'Unknown CR'}
                                  </span>
                                </div>

                                {log.changedStudents.map((change, idx) => {
                                  const details = getStudentDetails(change.studentId);
                                  return (
                                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-md gap-2">
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 truncate">
                                          <span className="text-gray-400 shrink-0">{details.rollNo}.</span>
                                          <span className="truncate">{details.name}</span>
                                        </div>
                                        <span className="text-[11px] text-gray-500 ml-4">{details.idNo}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold shrink-0">
                                        <span className={`px-1.5 sm:px-2 py-0.5 rounded ${change.oldStatus === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          <span className="hidden md:inline">{change.oldStatus === 'present' ? 'Present' : 'Absent'}</span>
                                          <span className="md:hidden">{change.oldStatus === 'present' ? 'Pr' : 'Ab'}</span>
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className={`px-1.5 sm:px-2 py-0.5 rounded ${change.newStatus === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          <span className="hidden md:inline">{change.newStatus === 'present' ? 'Present' : 'Absent'}</span>
                                          <span className="md:hidden">{change.newStatus === 'present' ? 'Pr' : 'Ab'}</span>
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
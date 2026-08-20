// src/pages/admin/ClassAttendanceReport.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Smartphone } from 'lucide-react';
import { getStudentsByClass, getClassAttendance, getClassById } from '../../firebase/services';
import { createCRAttendanceExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ClassAttendanceReport = () => {
  const { classId } = useParams();
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isStudent = currentUser?.role === 'student';
  const backLink = isStudent ? '/student/dashboard' : '/admin/classes';

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
    dates.forEach(d => {
      if (getStatus(studentId, d) === 'P') present++;
    });
    return { present, total: dates.length };
  };

  const getPercentage = (studentId) => {
    const { present, total } = getTotal(studentId);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  // Get latest date status for mobile view
  const getLatestDateStatus = (studentId) => {
    const dates = getUniqueDates();
    if (dates.length === 0) return '-';
    const latestDate = dates[dates.length - 1];
    return getStatus(studentId, latestDate);
  };

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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Class Attendance Report</h1>
              <p className="text-gray-600 text-sm">
                {classData?.name || 'Loading...'} • Attendance taken by CRs
                {isStudent && <span className="ml-2 text-indigo-600 font-medium">(CR View)</span>}
              </p>
            </div>
            <Button icon={Download} size="sm" onClick={handleExport}>Export Excel</Button>
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
                <p className="text-gray-400 text-sm mt-2">
                  Start by taking attendance from the CR panel.
                </p>
              )}
            </Card>
          ) : (
            <>
              {/* ════════════════════════════════════════════ */}
              {/* MOBILE VIEW: S.No, ID, Latest Date, Total  */}
              {/* ════════════════════════════════════════════ */}
              <div className="block md:hidden">
                <Card className="overflow-hidden p-0">
                  {/* Mobile header info */}
                  <div className="bg-indigo-50 px-4 py-2 border-b flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs text-indigo-600">
                      Showing summary view • Export Excel for full report
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600 w-10">S.No</th>
                          <th className="px-3 py-3 border-b text-left text-xs font-semibold text-gray-600">ID</th>
                          <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600">
                            <div>{latestDate}</div>
                            <div className="text-[10px] text-gray-400 font-normal">(Latest)</div>
                          </th>
                          <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600">Total</th>
                          {/* <th className="px-3 py-3 border-b text-center text-xs font-semibold text-gray-600">%</th> */}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          const latestStatus = getLatestDateStatus(stu.id);

                          return (
                            <tr key={stu.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2.5 text-gray-500 text-xs">{index + 1}</td>
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-gray-800 text-xs">{stu.studentId}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{stu.name}</p>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-block w-7 h-7 leading-7 rounded-full text-xs font-bold ${
                                  latestStatus === 'P' ? 'bg-green-100 text-green-700' :
                                  latestStatus === 'A' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-400'
                                }`}>
                                  {latestStatus}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-xs font-bold text-blue-700">{present}/{total}</span>
                              </td>
                              {/* <td className="px-3 py-2.5 text-center">
                                <span className={`text-xs font-bold ${
                                  pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {pct}%
                                </span>
                              </td> */}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* ════════════════════════════════════════════ */}
              {/* DESKTOP VIEW: Full scrollable table         */}
              {/* ════════════════════════════════════════════ */}
              <div className="hidden md:block">
                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-100 text-gray-700 font-semibold">
                        <tr>
                          {/* S.No - Sticky */}
                          <th className="p-3 border-b sticky left-0 bg-gray-100 z-20 w-12 text-center">
                            S.No
                          </th>
                          {/* ID - Sticky */}
                          <th className="p-3 border-b sticky left-12 bg-gray-100 z-20 w-28 min-w-[112px]">
                            ID
                          </th>
                          {/* Name - Sticky */}
                          <th className="p-3 border-b sticky left-40 bg-gray-100 z-20 w-44 min-w-[176px]">
                            Name
                          </th>
                          {/* Date columns - Scrollable */}
                          {dates.map(d => (
                            <th key={d} className="p-3 border-b text-center min-w-[90px]">{d}</th>
                          ))}
                          {/* Total - Sticky right */}
                          <th className="p-3 border-b text-center bg-blue-50 sticky right-16 z-20 min-w-[70px] border-l">
                            Total
                          </th>
                          {/* % - Sticky right */}
                          <th className="p-3 border-b text-center bg-blue-50 sticky right-0 z-20 min-w-[60px] border-l">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu, index) => {
                          const { present, total } = getTotal(stu.id);
                          const pct = getPercentage(stu.id);

                          return (
                            <tr key={stu.id} className="border-b hover:bg-gray-50">
                              {/* S.No - Sticky */}
                              <td className="p-3 text-center text-gray-500 sticky left-0 bg-white z-10 border-r">
                                {index + 1}
                              </td>
                              {/* ID - Sticky */}
                              <td className="p-3 font-medium text-gray-900 sticky left-12 bg-white z-10">
                                {stu.studentId}
                              </td>
                              {/* Name - Sticky */}
                              <td className="p-3 text-gray-700 sticky left-40 bg-white z-10 border-r">
                                {stu.name}
                              </td>
                              {/* Date cells - Scrollable */}
                              {dates.map(d => (
                                <td key={d} className="p-3 text-center">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                    getStatus(stu.id, d) === 'P' ? 'bg-green-100 text-green-700' :
                                    getStatus(stu.id, d) === 'A' ? 'bg-red-100 text-red-700' :
                                    'text-gray-400'
                                  }`}>
                                    {getStatus(stu.id, d)}
                                  </span>
                                </td>
                              ))}
                              {/* Total - Sticky right */}
                              <td className="p-3 text-center font-bold text-blue-700 bg-blue-50 sticky right-16 z-10 border-l">
                                {present}/{total}
                              </td>
                              {/* % - Sticky right */}
                              <td className={`p-3 text-center font-bold bg-blue-50 sticky right-0 z-10 border-l ${
                                pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {pct}%
                              </td>
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
    </div>
  );
};

export default ClassAttendanceReport;
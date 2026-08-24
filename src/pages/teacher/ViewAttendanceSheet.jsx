import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, AlertTriangle, Eye, ChevronDown, ChevronUp, Plus, Save, X, Smartphone, CalendarCheck, BookOpen, FlaskConical, Clock } from 'lucide-react';
import { getSubjectById, getClassById, getAttendanceForSubjectAndClass, getStudentsByClass, saveSessionAttendance, getClassAttendance } from '../../firebase/services';
import { createAttendanceExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';

const ViewAttendanceSheet = () => {
  const { subjectId, classId } = useParams();
  const { currentUser } = useAuth();
  
  const [subject, setSubject] = useState(null);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [showLowAttendance, setShowLowAttendance] = useState(false);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualDate, setManualDate] = useState(getTodayDate());
  const [manualMaxCount, setManualMaxCount] = useState(1);
  const [manualAttendance, setManualAttendance] = useState({}); 
  const [savingManual, setSavingManual] = useState(false);

  // ✅ NEW: Sync CR Attendance State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDate, setSyncDate] = useState(getTodayDate());
  const [syncSubject, setSyncSubject] = useState(''); // ✅ NEW
  const [syncUnit, setSyncUnit] = useState('');
  const [syncTopic, setSyncTopic] = useState('');
  const [syncSessionType, setSyncSessionType] = useState('class');
  const [syncing, setSyncing] = useState(false);
  
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const fetchData = useCallback(async (force = false) => {
    const [subjectResult, classResult, studentsResult, attendanceResult] = await Promise.all([
      getSubjectById(subjectId, force),
      getClassById(classId, force),
      getStudentsByClass(classId, force),
      getAttendanceForSubjectAndClass(subjectId, classId, { force })
    ]);

    if (subjectResult.success) setSubject(subjectResult.data);
    if (classResult.success) setClassData(classResult.data);
    if (studentsResult.success) setStudents(studentsResult.data);

    if (attendanceResult.success) {
      setAttendance(attendanceResult.data);
      if (studentsResult.success && subjectResult.success) {
        const lowAtt = [];
        const dateCapacities = subjectResult.data?.dateCapacities?.[classId] || {};

        studentsResult.data.forEach(student => {
          const studentRecords = attendanceResult.data.filter(a => a.oderId === student.id);
          if (studentRecords.length === 0) return;

          let present = 0;
          studentRecords.forEach(rec => {
            if (rec.status === 'present') {
              present += (rec.count || 1);
            }
          });

          let studentTotal = 0;
          studentRecords.forEach(rec => {
            studentTotal += (dateCapacities[rec.date] || 1);
          });

          const percentage = studentTotal > 0 ? Math.round((present / studentTotal) * 100) : 0;

          if (percentage < 75 && studentTotal > 0) {
            lowAtt.push({ ...student, stats: { present, absent: studentTotal - present, total: studentTotal, percentage } });
          }
        });
        lowAtt.sort((a, b) => a.stats.percentage - b.stats.percentage);
        setLowAttendanceStudents(lowAtt);
      }
    }

    setLoading(false);
  }, [subjectId, classId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, attendance]);

  const handleMouseDown = (e) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (scrollRef.current) {
        scrollRef.current.style.cursor = 'grab';
        scrollRef.current.style.userSelect = 'auto';
      }
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    try {
      const dateCapacities = subject?.dateCapacities?.[classId] || {};
      const fileName = createAttendanceExcel(attendance, subject?.name || 'Subject', classData?.name || 'Class', dateCapacities, students);
      toast.success(`Downloaded: ${fileName}`);
    } catch (error) {
      toast.error('Failed to download');
    }
    setDownloading(false);
  };

  const getDateCapacity = (date) => {
    const fromSubject = subject?.dateCapacities?.[classId]?.[date];
    if (fromSubject) return fromSubject;
    const recordsOnDate = attendance.filter(a => a.date === date);
    return recordsOnDate.reduce((max, r) => Math.max(max, r.maxCount || r.count || 1), 1);
  };

  const openManualModal = () => {
    const initialAtt = {};
    students.forEach(s => initialAtt[s.id] = 1);
    setManualAttendance(initialAtt);
    setManualDate(getTodayDate());
    setManualMaxCount(1);
    setShowManualModal(true);
  };

  const handleFillAllPresent = () => {
    const att = {};
    const count = parseInt(manualMaxCount) || 1;
    students.forEach(s => att[s.id] = count);
    setManualAttendance(att);
    toast.success(`All students marked Present for ${count} periods`);
  };

  const handleMaxCountChange = (value) => {
    setManualMaxCount(value);
    const max = parseInt(value) || 1;
    setManualAttendance(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, val]) => {
        next[id] = Math.min(val, max);
      });
      return next;
    });
  };

  const handleStudentCountChange = (studentId, value) => {
    const val = parseInt(value) || 0;
    const max = parseInt(manualMaxCount) || 1;
    const validVal = Math.min(Math.max(val, 0), max);
    setManualAttendance(prev => ({ ...prev, [studentId]: validVal }));
  };

    const handleManualSave = async () => {
    if (!manualDate) { toast.error("Please select a date"); return; }
    
    // ✅ NEW: Prevent future dates
    if (manualDate > getTodayDate()) {
      return toast.error("Cannot add attendance for future dates.");
    }

    setSavingManual(true);
    const maxCountVal = parseInt(manualMaxCount) || 1;

    const records = students.map(student => {
      const attendedCount = manualAttendance[student.id] || 0;
      return {
        oderId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        status: attendedCount === 0 ? 'absent' : 'present',
        count: attendedCount === 0 ? maxCountVal : attendedCount,
        maxCount: maxCountVal,
        sessionType: 'cumulative'
      };
    });

    try {
      const result = await saveSessionAttendance({
        subjectId,
        classId,
        date: manualDate,
        records,
        meta: {
          subjectName: subject.name,
          subjectCode: subject.code,
          semesterId: subject.semesterId,
          semesterName: subject.semesterName,
          className: classData?.name,
          time: 'Manual Entry',
          sessionType: 'cumulative',
          markedBy: currentUser.uid,
          skipEmail: true // ✅ NEW: Skip emails for manual entries
        }
      });

      if (!result.success) throw new Error(result.error);

      toast.success(`Manual attendance saved for ${manualDate}`);
      setShowManualModal(false);
      fetchData(true);
    } catch (err) {
      toast.error(err.message || "Failed to save manual attendance");
      console.error(err);
    }
    setSavingManual(false);
  };

   // ✅ NEW: State for available subjects on the selected sync date
  const [availableSyncSubjects, setAvailableSyncSubjects] = useState([]);

  // ✅ NEW: Fetch subjects when sync date changes
  useEffect(() => {
    if (showSyncModal && syncDate) {
      const fetchCRData = async () => {
        const crRes = await getClassAttendance(classId);
        if (crRes.success) {
          const dayRecords = crRes.data.filter(l => l.date === syncDate);
          setAvailableSyncSubjects(dayRecords);
          if (dayRecords.length > 0) {
            setSyncSubject(dayRecords[0].subjectName); // Default to first subject
          } else {
            setSyncSubject(''); // No subjects
          }
        }
      };
      fetchCRData();
    }
  }, [showSyncModal, syncDate, classId]);

  // ✅ NEW: Handle CR Sync Submission
  const handleSyncSubmit = async () => {
    if (!syncDate) return toast.error("Please select a date.");
    if (!syncUnit.trim()) return toast.error("Unit is required.");
    if (!syncSubject) return toast.error("Please select a subject from CR's records.");
    
    if (syncDate > getTodayDate()) {
      return toast.error("Cannot sync attendance for future dates.");
    }

    if (uniqueDates.includes(syncDate)) {
      return toast.error(`Attendance for ${syncDate} already exists. You cannot overwrite it.`);
    }

    setSyncing(true);
    try {
      const crRes = await getClassAttendance(classId);
      if (!crRes.success) throw new Error("Failed to fetch CR attendance.");

      // Find the specific subject log for that date
      const crLog = crRes.data.find(l => l.date === syncDate && l.subjectName === syncSubject);
      if (!crLog || !crLog.records || crLog.records.length === 0) {
        toast.error(`CR has not submitted attendance for ${syncSubject} on ${syncDate}.`);
        setSyncing(false);
        return;
      }

      const sessionCount = syncSessionType === 'lab' ? 3 : 1;

      const mappedRecords = crLog.records.map(rec => {
        const student = students.find(s => s.id === rec.studentId);
        return {
          oderId: rec.studentId,
          studentId: rec.studentId,
          studentName: student?.name || 'Unknown',
          status: rec.status,
          count: sessionCount,
          maxCount: sessionCount,
          sessionType: syncSessionType
        };
      });

      const result = await saveSessionAttendance({
        subjectId,
        classId,
        date: syncDate,
        records: mappedRecords,
        meta: {
          subjectName: subject.name,
          subjectCode: subject.code,
          semesterId: subject.semesterId,
          semesterName: subject.semesterName,
          className: classData?.name,
          time: 'CR Sync',
          sessionType: syncSessionType,
          markedBy: currentUser.uid,
          teacherName: currentUser.name,
          unit: syncUnit,
          topic: syncTopic,
          skipEmail: true 
        }
      });

      if (result.success) {
        toast.success(`Attendance synced from CR for ${syncDate}!`);
        setShowSyncModal(false);
        setSyncUnit('');
        setSyncTopic('');
        fetchData(true); 
      } else {
        throw new Error(result.error || "Failed to sync attendance.");
      }
    } catch (err) {
      toast.error(err.message);
    }
    setSyncing(false);
  };

  if (loading) return <Loading />;

  const uniqueDates = [...new Set(attendance.map(a => a.date))].sort();
  const latestDate = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : null;

  const getCellValue = (records, date) => {
    const record = records.find(r => r.date === date);
    if (!record) return '-';
    if (record.status === 'absent') return '0(Ab)';
    return (record.count || 1).toString();
  };

  const getLatestDateValue = (studentRecords) => {
    if (!latestDate) return '-';
    return getCellValue(studentRecords, latestDate);
  };

  const getGrandTotal = (studentRecords) => {
    let total = 0;
    const studentDates = [...new Set(studentRecords.map(r => r.date))];
    studentDates.forEach(date => {
      total += getDateCapacity(date);
    });
    return total;
  };

  const TOTAL_COL_W = 80;
  const PCT_COL_W = 64;
  const STICKY_RIGHT_TOTAL = PCT_COL_W;

  const stickyTotalHeaderStyle = {
    position: 'sticky',
    right: STICKY_RIGHT_TOTAL,
    zIndex: 20,
    backgroundColor: '#EFF6FF',
    boxShadow: '-4px 0 6px -2px rgba(0,0,0,0.08)',
    minWidth: TOTAL_COL_W,
  };

  const stickyPctHeaderStyle = {
    position: 'sticky',
    right: 0,
    zIndex: 20,
    backgroundColor: '#EFF6FF',
    minWidth: PCT_COL_W,
  };

  const stickyTotalCellStyle = {
    position: 'sticky',
    right: STICKY_RIGHT_TOTAL,
    zIndex: 10,
    backgroundColor: '#EFF6FF',
    boxShadow: '-4px 0 6px -2px rgba(0,0,0,0.08)',
    minWidth: TOTAL_COL_W,
  };

  const stickyPctCellStyle = {
    position: 'sticky',
    right: 0,
    zIndex: 10,
    backgroundColor: '#EFF6FF',
    minWidth: PCT_COL_W,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-full px-4 py-4 sm:py-8 overflow-x-hidden">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/teacher/subject/${subjectId}`} className="inline-flex items-center text-gray-600 hover:text-gray-800 text-sm whitespace-nowrap flex-shrink-0">
              <ArrowLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Back</span>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">Attendance Sheet</h1>
          </div>
          
          {/* Desktop Buttons - Hidden on Mobile */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" icon={CalendarCheck} onClick={() => setShowSyncModal(true)}>
              Use CR Attendance
            </Button>
            <Button variant="secondary" size="sm" icon={Plus} onClick={openManualModal}>
              Add Entry
            </Button>
            <Button icon={Download} size="sm" onClick={handleDownload} loading={downloading}>
              Excel
            </Button>
          </div>
        </div>

        {/* Mobile Buttons - Shown only on Mobile with space-between */}
        <div className="flex md:hidden items-center justify-between gap-2 mb-3">
          <Button variant="secondary" size="sm" icon={CalendarCheck} onClick={() => setShowSyncModal(true)}>
            CR Sync
          </Button>
          <Button variant="secondary" size="sm" icon={Plus} onClick={openManualModal}>
            Add
          </Button>
          <Button icon={Download} size="sm" onClick={handleDownload} loading={downloading}>
            Excel
          </Button>
        </div>

        {/* Subject and Class Info */}
        <p className="text-gray-600 text-sm">{subject?.name} • {classData?.name}</p>
      </div>

        {/* Low Attendance Alert */}
        {lowAttendanceStudents.length > 0 && (
          <div className="max-w-7xl mx-auto mb-4 sm:mb-6">
            <Card className="bg-red-50 border border-red-200 p-0 overflow-hidden">
              <button onClick={() => setShowLowAttendance(!showLowAttendance)} className="w-full px-3 py-2 sm:p-4 flex items-center justify-between hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                  <h2 className="font-bold text-red-800 text-xs sm:text-base">Low Attendance ({lowAttendanceStudents.length})</h2>
                </div>
                {showLowAttendance ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />}
              </button>

              {showLowAttendance && (
                <div className="px-3 pb-3 sm:p-4 sm:pt-0 border-t border-red-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mt-2 sm:mt-4">
                    {lowAttendanceStudents.map(student => (
                      <div key={student.id} className="bg-white p-2 sm:p-3 rounded-lg border border-red-100 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-red-600 flex-shrink-0">{student.name.charAt(0)}</div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 text-xs sm:text-sm truncate">{student.name}</p>
                            <p className="text-[10px] sm:text-xs text-red-600 font-medium">{student.stats.percentage}%</p>
                          </div>
                        </div>
                        <Link to={`/student/details/${student.id}`}>
                          <Button size="sm" variant="secondary" icon={Eye}>
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* MOBILE VIEW */}
        <div className="block md:hidden max-w-7xl mx-auto">
          <Card className="overflow-hidden p-0">
            <div className="bg-indigo-50 px-4 py-2 border-b flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              <p className="text-xs text-indigo-600">Summary view • Download Excel for full report</p>
            </div>

            {uniqueDates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No attendance records yet</p>
              </div>
            ) : (
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
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const studentRecords = attendance.filter(a => a.oderId === student.id);
                      const totalPresents = studentRecords.filter(r => r.status === 'present').reduce((acc, r) => acc + (r.count || 1), 0);
                      const grandTotal = getGrandTotal(studentRecords);
                      const latestVal = getLatestDateValue(studentRecords);

                      return (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{index + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-800 text-xs">{student.studentId}</p>
                            <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{student.name}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block min-w-[32px] px-1.5 py-1 rounded text-xs font-bold ${
                              latestVal === '0(Ab)' ? 'bg-red-100 text-red-700' :
                              latestVal === '-' ? 'bg-gray-100 text-gray-400' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {latestVal}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs font-bold text-blue-700">{totalPresents}/{grandTotal}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* DESKTOP VIEW */}
        <div className="hidden md:block">
          <Card className="max-w-7xl mx-auto overflow-hidden p-0">
            {uniqueDates.length > 5 && (
              <div className="bg-gray-50 px-4 py-1.5 border-b flex items-center justify-center gap-2">
                <span className="text-[11px] text-gray-400">← Click and drag to scroll →</span>
              </div>
            )}
            <div 
              ref={scrollRef}
              className="overflow-x-auto"
              style={{ cursor: 'grab' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <table className="text-sm text-left whitespace-nowrap" style={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}>
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="p-3 border-b sticky left-0 bg-gray-100 z-20 w-12 text-center">S.No</th>
                    <th className="p-3 border-b sticky left-12 bg-gray-100 z-20 w-28 min-w-[112px]">ID</th>
                    <th className="p-3 border-b sticky left-40 bg-gray-100 z-20 w-44 min-w-[176px] border-r">Name</th>
                    {uniqueDates.map((date, idx) => {
                      const record = attendance.find(a => a.date === date);
                      const isCumulative = record?.sessionType === 'cumulative';
                      const capacity = getDateCapacity(date);
                      
                      return (
                        <th key={idx} className="p-3 border-b text-center min-w-[90px]">
                          {date}
                          {isCumulative && (
                            <span className="ml-1 text-xs text-blue-600 font-normal">({capacity})</span>
                          )}
                          {record?.sessionType === 'lab' && (
                            <span className="ml-1 text-xs text-purple-600 font-normal">(Lab)</span>
                          )}
                        </th>
                      );
                    })}
                    <th className="p-3 border-b text-center border-l" style={stickyTotalHeaderStyle}>Total</th>
                    <th className="p-3 border-b text-center border-l" style={stickyPctHeaderStyle}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => {
                    const studentRecords = attendance.filter(a => a.oderId === student.id);
                    const totalPresents = studentRecords.filter(r => r.status === 'present').reduce((acc, r) => acc + (r.count || 1), 0);
                    const grandTotal = getGrandTotal(studentRecords);
                    const pct = grandTotal > 0 ? Math.round((totalPresents / grandTotal) * 100) : 0;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50 border-b">
                        <td className="p-3 text-center text-gray-500 sticky left-0 bg-white z-10 border-r">{index + 1}</td>
                        <td className="p-3 font-medium text-gray-900 sticky left-12 bg-white z-10">{student.studentId}</td>
                        <td className="p-3 text-gray-700 sticky left-40 bg-white z-10 border-r">{student.name}</td>
                        {uniqueDates.map((date, dIdx) => (
                          <td key={dIdx} className="p-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                              getCellValue(studentRecords, date) === '0(Ab)' 
                                ? 'bg-red-100 text-red-700' 
                                : getCellValue(studentRecords, date) === '-'
                                  ? 'text-gray-400'
                                  : 'bg-green-100 text-green-700'
                            }`}>
                              {getCellValue(studentRecords, date)}
                            </span>
                          </td>
                        ))}
                        <td className="p-3 text-center font-bold text-blue-700 border-l" style={stickyTotalCellStyle}>{totalPresents}/{grandTotal}</td>
                        <td className={`p-3 text-center font-bold border-l ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`} style={stickyPctCellStyle}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl my-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Add Manual Attendance Entry</h2>
                    <Button variant="secondary" size="sm" icon={X} onClick={() => setShowManualModal(false)} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Total Days/Periods</label>
                        <input type="number" min="1" value={manualMaxCount} onChange={e => handleMaxCountChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 30" />
                        <p className="text-xs text-gray-400 mt-1">Max count for this session.</p>
                    </div>
                </div>

                <div className="mb-4">
                    <Button size="sm" variant="success" onClick={handleFillAllPresent}>Mark All Present ({manualMaxCount || 1})</Button>
                </div>

                <div className="mb-2 text-sm text-gray-600">Enter attended periods for each student (0 to {manualMaxCount || 1}):</div>

                <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-2 text-left">Student</th>
                                <th className="p-2 text-center w-32">Attended Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(s => (
                                <tr key={s.id} className="border-t">
                                    <td className="p-2">{s.name} <span className="text-gray-400 text-xs">({s.studentId})</span></td>
                                    <td className="p-2 text-center">
                                        <input type="number" min="0" max={manualMaxCount || 1} value={manualAttendance[s.id] || 0} onChange={(e) => handleStudentCountChange(s.id, e.target.value)} className="w-16 px-2 py-1 border rounded text-center" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={() => setShowManualModal(false)}>Cancel</Button>
                    <Button icon={Save} onClick={handleManualSave} loading={savingManual}>Save Entry</Button>
                </div>
            </Card>
        </div>
      )}

      {/* ✅ NEW: Use CR Attendance Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg my-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-lg">
                  <CalendarCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Use CR Attendance</h2>
                  <p className="text-sm text-gray-500">Sync records taken by Class Representatives</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={X} onClick={() => setShowSyncModal(false)} />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                  <input 
                    type="date" 
                    value={syncDate} 
                    onChange={e => setSyncDate(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CR Subject</label>
                  <select 
                    value={syncSubject} 
                    onChange={e => setSyncSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableSyncSubjects.length === 0 ? (
                      <option value="">No CR records for this date</option>
                    ) : (
                      availableSyncSubjects.map(sub => (
                        <option key={sub.id} value={sub.subjectName}>{sub.subjectName}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit <span className="text-red-500">*</span></label>
                  <input type="text" value={syncUnit} onChange={e => setSyncUnit(e.target.value)} placeholder="e.g., Unit 1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic Covered</label>
                  <input type="text" value={syncTopic} onChange={e => setSyncTopic(e.target.value)} placeholder="e.g., Introduction" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Count as Session Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSyncSessionType('class')} className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all ${syncSessionType === 'class' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <BookOpen className="w-4 h-4" /><span className="font-medium text-sm">Class (×1)</span>
                  </button>
                  <button type="button" onClick={() => setSyncSessionType('lab')} className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all ${syncSessionType === 'lab' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <FlaskConical className="w-4 h-4" /><span className="font-medium text-sm">Lab (×3)</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  This will fetch the CR's attendance for {syncSubject || "the selected subject"} on {syncDate} and apply it to this subject. 
                  If you already took attendance for this date, the sync will be blocked.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowSyncModal(false)}>Cancel</Button>
                <Button icon={CalendarCheck} onClick={handleSyncSubmit} loading={syncing} disabled={!syncSubject}>
                  Sync Attendance
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ViewAttendanceSheet;
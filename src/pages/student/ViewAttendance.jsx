import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calendar, TrendingUp, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjectsForStudent, getAttendanceForStudent } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const ViewAttendance = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState('all');
  const [studentSemester, setStudentSemester] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});

  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [subjectsResult, attendanceResult] = await Promise.all([
        getSubjectsForStudent(currentUser.classId),
        getAttendanceForStudent(currentUser.uid)
      ]);

      if (subjectsResult.success) {
        setSubjects(subjectsResult.data);
        if (subjectsResult.data.length > 0) {
          const firstSubject = subjectsResult.data[0];
          setStudentSemester({ id: firstSubject.semesterId, name: firstSubject.semesterName });
        } else if (currentUser.semesterId) {
           setStudentSemester({ id: currentUser.semesterId, name: currentUser.semesterName });
        }
      }

      if (attendanceResult.success) setAttendance(attendanceResult.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getSubjectStats = (subject, attRecords) => {
    const subAtt = attRecords.filter(a => a.subjectId === subject.id);

    if (subAtt.length === 0) {
      return { grandTotal: 0, presentCount: 0 };
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

    return { grandTotal, presentCount };
  };

  const calculateAttendanceStatsWithCapacities = (attRecords, subjectsToUse) => {
    if (!attRecords || attRecords.length === 0) {
      return { present: 0, absent: 0, total: 0, percentage: 0 };
    }

    let grandTotal = 0;
    let presentCount = 0;

    subjectsToUse.forEach(subject => {
      const stats = getSubjectStats(subject, attRecords);
      grandTotal += stats.grandTotal;
      presentCount += stats.presentCount;
    });

    const absent = grandTotal - presentCount;
    const percentage = grandTotal > 0 ? Math.round((presentCount / grandTotal) * 100) : 0;

    return { present: presentCount, absent, total: grandTotal, percentage };
  };

  const toggleDate = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const formatDayName = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  const formatDisplayDate = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) return <Loading />;

  const targetSemesterId = studentSemester?.id || 'none';

  const filteredBySemester = attendance.filter(a => a.semesterId === targetSemesterId);

  const filteredAttendance = selectedSubject === 'all'
    ? filteredBySemester
    : filteredBySemester.filter(a => a.subjectId === selectedSubject);

  const filteredSubjects = subjects.filter(s => s.semesterId === targetSemesterId);

  const stats = calculateAttendanceStatsWithCapacities(filteredAttendance, filteredSubjects);

  const getDoughnutData = () => ({
    labels: ['Present', 'Absent'],
    datasets: [{ data: [stats.present, stats.absent], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2 }],
  });

  const getSubjectWiseData = () => {
    const labels = [];
    const presentData = [];
    const absentData = [];

    filteredSubjects.forEach(subject => {
      const hasRecords = filteredAttendance.some(a => a.subjectId === subject.id);
      if (!hasRecords) return;

      const { grandTotal, presentCount } = getSubjectStats(subject, filteredAttendance);
      const absentCount = grandTotal - presentCount;

      labels.push(subject.name);
      presentData.push(presentCount);
      absentData.push(absentCount);
    });

    return {
      labels,
      datasets: [
        { label: 'Present', data: presentData, backgroundColor: '#22c55e' },
        { label: 'Absent', data: absentData, backgroundColor: '#ef4444' },
      ],
    };
  };

  const groupedByDate = (() => {
    const grouped = {};
    filteredAttendance.forEach(record => {
      const date = record.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(record);
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    return sortedDates.map(date => ({ date, records: grouped[date] }));
  })();

  const mostRecentDate = groupedByDate.length > 0 ? groupedByDate[0].date : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
            <div>
                <Link to="/student/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2 text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">Attendance Report</h1>
                <p className="text-gray-600 text-sm">{studentSemester?.name || 'No Semester'}</p>
            </div>
        </div>

        <Card className="mb-4 p-3 border border-blue-100 bg-blue-50/50">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1"><BookOpen className="w-3 h-3 inline mr-1" />Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="all">All Subjects</option>
                  {filteredSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
            </div>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="text-center p-3"><p className="text-xl font-bold text-blue-600">{stats.percentage}%</p><p className="text-xs text-gray-500">Percentage</p></Card>
          <Card className="text-center p-3"><p className="text-xl font-bold text-purple-600">{stats.total}</p><p className="text-xs text-gray-500">Total</p></Card>
          <Card className="text-center p-3"><p className="text-xl font-bold text-green-600">{stats.present}</p><p className="text-xs text-gray-500">Present</p></Card>
          <Card className="text-center p-3"><p className="text-xl font-bold text-red-600">{stats.absent}</p><p className="text-xs text-gray-500">Absent</p></Card>
        </div>

        {stats.percentage < 75 && stats.total > 0 && (
          <Card className={`mb-4 p-3 ${stats.percentage < 50 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border`}>
            <div className="flex items-center gap-2"><TrendingUp className={`w-4 h-4 ${stats.percentage < 50 ? 'text-red-600' : 'text-yellow-600'}`} /><p className={`text-sm ${stats.percentage < 50 ? 'text-red-700' : 'text-yellow-700'}`}>Your attendance is below 75%.</p></div>
          </Card>
        )}

        {filteredAttendance.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card className="p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Overall Distribution</h3>
              <div className="flex justify-center"><div style={{ maxWidth: '200px' }}><Doughnut data={getDoughnutData()} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} /></div></div>
            </Card>
            {selectedSubject === 'all' && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">By Subject</h3>
                <Bar data={getSubjectWiseData()} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }} />
              </Card>
            )}
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-white">
            <h3 className="font-semibold text-gray-800 text-sm">Attendance History</h3>
          </div>

          {groupedByDate.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No attendance records yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {groupedByDate.map(({ date, records }) => {
                const isExpanded = expandedDates[date] !== undefined
                  ? expandedDates[date]
                  : date === mostRecentDate;

                const presentCount = records.filter(r => r.status === 'present').length;
                const absentCount = records.filter(r => r.status !== 'present').length;
                const dayName = formatDayName(date);
                const displayDate = formatDisplayDate(date);

                return (
                  <div key={date}>
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-800">{displayDate}</p>
                          <p className="text-xs text-gray-400">{dayName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          {presentCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[11px] font-bold">{presentCount}P</span>
                          )}
                          {absentCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[11px] font-bold">{absentCount}A</span>
                          )}
                        </div>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        }
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1.5">
                        {records.map((record) => (
                          <div key={record.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg ml-6 sm:ml-8">
                            <div className="flex items-center gap-2 min-w-0">
                              {record.status === 'present'
                                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              }
                              <div className="min-w-0">
                                <p className="font-medium text-gray-700 text-sm truncate">{record.subjectName}</p>
                                {record.time && record.time !== 'Manual Entry' && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {record.time}
                                  </p>
                                )}
                                {(record.unit || record.topic) && (
                                  <p className="text-xs text-blue-500 mt-0.5">
                                    {record.unit && `Unit: ${record.unit}`}
                                    {record.unit && record.topic && " | "}
                                    {record.topic && `Topic: ${record.topic}`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {record.status === 'present' ? 'P' : 'A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default ViewAttendance;
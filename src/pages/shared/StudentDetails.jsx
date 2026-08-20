import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, IdCard, CheckCircle, XCircle, TrendingUp, Layers } from 'lucide-react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getAttendanceForStudent, getSubjectsForStudent } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const StudentDetails = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
  }, [studentId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Info
      const studentRef = doc(db, 'users', studentId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        toast.error('Student not found');
        navigate(-1);
        return;
      }

      const studentData = { id: studentSnap.id, ...studentSnap.data() };
      setStudent(studentData);

      // 2. Fetch Attendance and Subjects in parallel
      const [attRes, subjectsRes] = await Promise.all([
        getAttendanceForStudent(studentId),
        getSubjectsForStudent(studentData.classId)
      ]);

      if (attRes.success) {
        setAttendance(attRes.data);
      }

      if (subjectsRes.success) {
        setSubjects(subjectsRes.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch details');
    }
    setLoading(false);
  };

  const getSubjectStats = (subject, attRecords, classId) => {
    const subAtt = attRecords.filter(a => a.subjectId === subject.id);

    if (subAtt.length === 0) {
      return { grandTotal: 0, presentCount: 0 };
    }

    const capacities = subject.dateCapacities?.[classId] || {};
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

  const calculateAttendanceStatsWithCapacities = (attRecords, subjectsToUse, classId) => {
    if (!attRecords || attRecords.length === 0) {
      return { present: 0, absent: 0, total: 0, percentage: 0 };
    }

    let grandTotal = 0;
    let presentCount = 0;

    subjectsToUse.forEach(subject => {
      const stats = getSubjectStats(subject, attRecords, classId);
      grandTotal += stats.grandTotal;
      presentCount += stats.presentCount;
    });

    const absent = grandTotal - presentCount;
    const percentage = grandTotal > 0 ? Math.round((presentCount / grandTotal) * 100) : 0;

    return { present: presentCount, absent, total: grandTotal, percentage };
  };

  if (loading) return <Loading />;
  if (!student) return null;

  const stats = calculateAttendanceStatsWithCapacities(attendance, subjects, student.classId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to={-1}
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        {/* Header Card */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {student.name?.charAt(0).toUpperCase()}
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-500 mt-1">
                <IdCard className="w-4 h-4" />
                <span>{student.studentId}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div>
              <label className="text-xs text-gray-500">Class</label>
              <p className="font-medium text-gray-800 flex items-center gap-1">
                <Layers className="w-4 h-4 text-gray-400" />
                {student.className || 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Gender</label>
              <p className="font-medium text-gray-800">{student.gender || 'N/A'}</p>
            </div>
             <div>
              <label className="text-xs text-gray-500">Email</label>
              <p className="font-medium text-gray-800 flex items-center gap-1">
                <Mail className="w-4 h-4 text-gray-400" />
                {student.email}
              </p>
            </div>
          </div>
        </Card>

        {/* Attendance Stats */}
        <h2 className="text-lg font-bold text-gray-800 mb-3">Attendance Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="text-center p-4 bg-blue-50 border border-blue-100">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-blue-600">Total Classes</p>
          </Card>
          <Card className="text-center p-4 bg-green-50 border border-green-100">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-green-600">Present</p>
          </Card>
          <Card className="text-center p-4 bg-red-50 border border-red-100">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-red-600">Absent</p>
          </Card>
          <Card className={`text-center p-4 ${stats.percentage >= 75 ? 'bg-green-100' : 'bg-red-100'} border`}>
            <p className={`text-2xl font-bold ${stats.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.percentage}%
            </p>
            <p className={`text-xs ${stats.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>Percentage</p>
          </Card>
        </div>

        {/* Attendance History */}
        <h2 className="text-lg font-bold text-gray-800 mb-3">Recent History</h2>
        <Card className="p-0 overflow-hidden">
          {attendance.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No attendance records found.</div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {attendance.slice(0, 20).map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    {rec.status === 'present' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm text-gray-800">{rec.subjectName}</p>
                      <p className="text-xs text-gray-500">{rec.date} {rec.time && `• ${rec.time}`}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    rec.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {rec.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Warning */}
        {stats.percentage < 75 && stats.total > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-bold text-red-800">Low Attendance Warning</h3>
              <p className="text-sm text-red-600">This student's attendance is below the 75% requirement.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDetails;
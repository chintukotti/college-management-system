import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Save, Edit2, CheckCircle, AlertCircle, BookOpen, Plus } from 'lucide-react';
import { getStudentsByClass, markClassAttendance, getClassAttendance, updateClassAttendance } from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';

const TakeClassAttendance = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [existingRecords, setExistingRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [subjectName, setSubjectName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const today = getTodayDate();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await getStudentsByClass(currentUser.classId);
    if (res.success) {
      setStudents(res.data);
      const initial = {};
      res.data.forEach(s => initial[s.id] = 'present');
      setAttendance(initial);
      
      const attRes = await getClassAttendance(currentUser.classId);
      if (attRes.success) {
        setExistingRecords(attRes.data.filter(r => r.date === today));
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setIsEditing(false);
    setEditingRecord(null);
    setSubjectName('');
    const initial = {};
    students.forEach(s => initial[s.id] = 'present');
    setAttendance(initial);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setSubjectName(record.subjectName);
    const filledState = {};
    record.records.forEach(r => { filledState[r.studentId] = r.status; });
    setAttendance(filledState);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!subjectName.trim()) {
      toast.error("Please enter the subject name");
      return;
    }
    setSaving(true);
    const records = students.map(s => ({ studentId: s.id, status: attendance[s.id] }));

    let res;
    if (isEditing && editingRecord) {
      res = await updateClassAttendance(editingRecord.id, records, currentUser.classId, subjectName, currentUser.uid, currentUser.name);
    } else {
      res = await markClassAttendance(currentUser.classId, today, subjectName, records, currentUser.uid);
    }

    if (res.success) {
      toast.success(isEditing ? "Attendance Updated!" : "Attendance Submitted!");
      const attRes = await getClassAttendance(currentUser.classId);
      if (attRes.success) setExistingRecords(attRes.data.filter(r => r.date === today));
      resetForm();
    } else {
      toast.error(res.error);
    }
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/student/dashboard" className="inline-flex items-center text-gray-600 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Take Class Attendance</h1>
            <p className="text-gray-600 text-sm">Date: {today}</p>
          </div>
          {!showForm && (
            <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
              New Subject
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mb-6 border-2 border-blue-200 bg-blue-50/50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">{isEditing ? 'Edit Attendance' : 'New Subject Attendance'}</h2>
              <Button variant="secondary" size="sm" icon={X} onClick={resetForm}>Cancel</Button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
              <input 
                type="text" 
                value={subjectName} 
                onChange={e => setSubjectName(e.target.value)} 
                placeholder="e.g., Mathematics, Physics Lab"
                disabled={isEditing}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
              />
            </div>

            <div className="space-y-3 mb-6">
              {students.map((s, index) => (
                <div key={s.id} className="bg-white p-3 rounded-lg border flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.studentId}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => setAttendance(prev => ({...prev, [s.id]: 'present'}))}
                      className={`p-2 rounded ${attendance[s.id] === 'present' ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <Check className="w-5 h-5"/>
                    </button>
                    <button 
                      onClick={() => setAttendance(prev => ({...prev, [s.id]: 'absent'}))}
                      className={`p-2 rounded ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <X className="w-5 h-5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button fullWidth icon={Save} onClick={handleSave} loading={saving}>
              {isEditing ? "Update Attendance" : "Submit Attendance"}
            </Button>
          </Card>
        )}

        <h3 className="text-sm font-bold text-gray-600 uppercase mb-3">Today's Submitted Subjects</h3>
        {existingRecords.length === 0 ? (
          <Card className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No attendance submitted yet today.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {existingRecords.map(rec => {
              const presentCount = rec.records.filter(r => r.status === 'present').length;
              const isOwner = rec.markedBy === currentUser.uid;
              return (
                <Card key={rec.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{rec.subjectName}</h4>
                        <p className="text-xs text-gray-500">
                          {presentCount}/{rec.records.length} Present
                          {!isOwner && <span className="ml-2 text-gray-400">(Submitted by other CR)</span>}
                        </p>
                      </div>
                    </div>
                    {isOwner && (
                      <Button size="sm" variant="secondary" icon={Edit2} onClick={() => handleEdit(rec)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default TakeClassAttendance;
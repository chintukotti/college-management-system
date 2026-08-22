// src/pages/student/TakeClassAttendance.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Save, Edit2, CheckCircle, AlertCircle } from 'lucide-react';
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
  
  const [existingRecord, setExistingRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const today = getTodayDate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await getStudentsByClass(currentUser.classId);
    if (res.success) {
      setStudents(res.data);
      
      const initial = {};
      res.data.forEach(s => initial[s.id] = 'present');
      
      const attRes = await getClassAttendance(currentUser.classId);
      if (attRes.success) {
        const todayRecord = attRes.data.find(r => r.date === today);
        
        if (todayRecord) {
          setExistingRecord(todayRecord);
          const filledState = {};
          todayRecord.records.forEach(r => {
            filledState[r.studentId] = r.status;
          });
          setAttendance(filledState);
        } else {
          setAttendance(initial);
        }
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const records = students.map(s => ({
      studentId: s.id,
      status: attendance[s.id]
    }));

    let res;
    if (existingRecord) {
      // ✅ Pass currentUser.uid and currentUser.name to log who edited
      res = await updateClassAttendance(
        existingRecord.id, 
        records, 
        currentUser.classId, 
        currentUser.uid, 
        currentUser.name 
      );
    } else {
      res = await markClassAttendance(currentUser.classId, today, records, currentUser.uid);
    }

    if (res.success) {
      toast.success(existingRecord ? "Attendance Updated!" : "Attendance Submitted!");
      setIsEditing(false);
      fetchData();
    } else {
      toast.error(res.error);
    }
    setSaving(false);
  };

  const isOwner = existingRecord?.markedBy === currentUser.uid;
  const canEdit = isOwner && existingRecord?.date === today;

  if (loading) return <Loading />;

  // --- VIEW MODE ---
  if (existingRecord && !isEditing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <Link to="/student/dashboard" className="inline-flex items-center text-gray-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>

          <Card className={`mb-4 ${isOwner ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isOwner ? <CheckCircle className="w-5 h-5 text-green-600"/> : <AlertCircle className="w-5 h-5 text-blue-600"/>}
                    <span className="font-medium text-gray-800">
                        {isOwner ? "You submitted today's attendance" : "Attendance already submitted"}
                    </span>
                </div>
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} icon={Edit2}>
                    Edit
                  </Button>
                )}
            </div>
            {!isOwner && (
               <p className="text-xs text-gray-500 mt-2 ml-7">Submitted by another CR. You can view but not edit.</p>
            )}
          </Card>

          {/* ✅ VIEW MODE with S.No */}
          <div className="space-y-3">
            {students.map((s, index) => (
              <div key={s.id} className="bg-white p-3 rounded-lg border flex items-center gap-3">
                {/* S.No */}
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                  {index + 1}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.studentId}</p>
                </div>
                {/* Status */}
                <span className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${
                  attendance[s.id] === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {attendance[s.id] === 'present' ? 'Present' : 'Absent'}
                </span>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // --- FORM MODE (Create or Edit) with S.No ---
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/student/dashboard" className="inline-flex items-center text-gray-600 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
                {isEditing ? "Edit Attendance" : "Take Class Attendance"}
            </h1>
            <p className="text-gray-600 text-sm">Date: {today}</p>
          </div>
        </div>

        <Card className="mb-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-700">
                {isEditing 
                    ? "You are editing today's attendance." 
                    : "Note: Once submitted, no other CR can submit for today."}
            </p>
        </Card>

        {/* ✅ FORM MODE with S.No */}
        <div className="space-y-3 mb-6">
          {students.map((s, index) => (
            <div key={s.id} className="bg-white p-3 rounded-lg border flex items-center gap-3">
              {/* S.No */}
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {index + 1}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{s.name}</p>
                <p className="text-xs text-gray-500">{s.studentId}</p>
              </div>
              {/* Buttons */}
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => setAttendance(prev => ({...prev, [s.id]: 'present'}))}
                  className={`p-2 rounded transition-colors ${
                    attendance[s.id] === 'present' ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Check className="w-5 h-5"/>
                </button>
                <button 
                  onClick={() => setAttendance(prev => ({...prev, [s.id]: 'absent'}))}
                  className={`p-2 rounded transition-colors ${
                    attendance[s.id] === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button 
          fullWidth 
          icon={Save} 
          onClick={handleSave} 
          loading={saving}
        >
          {isEditing ? "Update Attendance" : "Submit Attendance"}
        </Button>
      </main>
    </div>
  );
};

export default TakeClassAttendance;
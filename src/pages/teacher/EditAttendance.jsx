// src/pages/teacher/EditAttendance.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Save, RefreshCw, Hash } from 'lucide-react';
import { getAttendanceBySubjectAndDate, updateAttendanceBatch, getSubjectById, getAttendanceDatesForSubjectAndClass, getStudentsByClass } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const EditAttendance = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const [subject, setSubject] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  
  const [students, setStudents] = useState([]);
  const [recordsMap, setRecordsMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ NEW: Track max capacity for manual entries
  const [dateMaxCount, setDateMaxCount] = useState(1);
  const [originalRecords, setOriginalRecords] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, [subjectId]);

  useEffect(() => {
    if (selectedClassId) {
      fetchDates(selectedClassId);
    } else {
      setDates([]);
      setSelectedDate('');
    }
  }, [selectedClassId]);

  const fetchInitialData = async () => {
    const subRes = await getSubjectById(subjectId);
    if (subRes.success) setSubject(subRes.data);
    setLoading(false);
  };

  const fetchDates = async (classId) => {
    setSelectedDate('');
    setStudents([]);
    setRecordsMap({});
    const res = await getAttendanceDatesForSubjectAndClass(subjectId, classId);
    if (res.success) setDates(res.data);
  };

  const fetchRecords = async () => {
    if (!selectedDate || !selectedClassId) return;
    setLoading(true);
    
    try {
        const stuRes = await getStudentsByClass(selectedClassId);
        let orderedStudents = [];
        if (stuRes.success) {
            orderedStudents = stuRes.data.sort((a, b) => {
                const orderA = a.order ?? 999999;
                const orderB = b.order ?? 999999;
                return orderA - orderB;
            });
            setStudents(orderedStudents);
        }

        const attRes = await getAttendanceBySubjectAndDate(subjectId, selectedDate);
        if (attRes.success) {
            const filtered = attRes.data.filter(r => r.classId === selectedClassId);
            
            const map = {};
            filtered.forEach(r => { map[r.oderId] = r; });
            setRecordsMap(map);
            // Snapshot of the saved values, so the class totals can be
            // adjusted by the difference rather than recounted.
            setOriginalRecords(JSON.parse(JSON.stringify(map)));

            // ✅ FIX: Determine max capacity for this date
            // Try from subject doc first
            const fromSubject = subject?.dateCapacities?.[selectedClassId]?.[selectedDate];
            if (fromSubject) {
              setDateMaxCount(fromSubject);
            } else {
              // Fallback: max of (maxCount, count) across all records
              const maxFromRecords = filtered.reduce((max, r) => 
                Math.max(max, r.maxCount || r.count || 1), 1
              );
              setDateMaxCount(maxFromRecords);
            }
        }
    } catch (err) {
        toast.error("Error fetching data");
    }
    setLoading(false);
  };

  const toggleStatus = (studentId) => {
    const rec = recordsMap[studentId];
    if (!rec) return;

    // ✅ FIX: For manual entries, don't toggle — use count input only
    if (rec.sessionType === 'cumulative') return;
    
    setRecordsMap(prev => {
        const current = prev[studentId];
        if (!current) return prev;
        return {
            ...prev,
            [studentId]: { ...current, status: current.status === 'present' ? 'absent' : 'present' }
        };
    });
  };

  // ✅ FIXED: Auto-detect status for manual entries
  const updateCount = (studentId, newCount) => {
    const val = parseInt(newCount) || 0;
    const max = dateMaxCount;
    const clampedVal = Math.min(Math.max(val, 0), max);
    
    setRecordsMap(prev => {
        const current = prev[studentId];
        if (!current) return prev;
        
        // ✅ FIX: Auto set status based on count for manual entries
        if (current.sessionType === 'cumulative') {
          return { 
            ...prev, 
            [studentId]: { 
              ...current, 
              count: clampedVal === 0 ? max : clampedVal,  // Absent stores max, present stores attended
              status: clampedVal === 0 ? 'absent' : 'present'
            } 
          };
        }
        
        return { ...prev, [studentId]: { ...current, count: clampedVal } };
    });
  };

  // Saves every edited record in one batch and adjusts the class attendance
  // totals by the difference against what was originally loaded.
  const handleSave = async () => {
    setSaving(true);

    const updates = Object.values(recordsMap)
      .filter(rec => {
        const before = originalRecords[rec.oderId];
        if (!before) return false;
        return before.status !== rec.status || (before.count || 1) !== (rec.count || 1);
      })
      .map(rec => ({
        id: rec.id,
        oderId: rec.oderId,
        subjectId: rec.subjectId || subjectId,
        classId: rec.classId || selectedClassId,
        status: rec.status,
        count: rec.count || 1,
        maxCount: rec.maxCount || dateMaxCount,
        previous: originalRecords[rec.oderId]
      }));

    if (updates.length === 0) {
      toast('No changes to save');
      setSaving(false);
      return;
    }

    const result = await updateAttendanceBatch(updates);
    if (result.success) {
      toast.success(`Updated ${updates.length} record(s)`);
      navigate(-1);
    } else {
      toast.error(result.error || 'Failed to update');
    }
    setSaving(false);
  };

  if (loading && !subject) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link to={`/teacher/subject/${subjectId}`} className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Edit Attendance</h1>
          <p className="text-sm text-gray-500">{subject?.name}</p>
        </div>

        <Card className="mb-4 p-4 bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-700">
                Select Class and Date. Only classes with attendance taken will show dates.
            </p>
        </Card>

        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                <select 
                  value={selectedClassId} 
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="">-- Select Class --</option>
                    {subject?.classes?.map(cls => (
                        <option key={cls.classId} value={cls.classId}>{cls.className}</option>
                    ))}
                </select>
             </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!selectedClassId}
                >
                  <option value="">-- Select Date --</option>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
             </div>

             <div className="flex items-end">
                <Button onClick={fetchRecords} icon={RefreshCw} className="w-full" disabled={!selectedDate}>Load</Button>
             </div>
          </div>
        </Card>

        {students.length > 0 && selectedDate && Object.keys(recordsMap).length > 0 && (
          <>
            {/* ✅ NEW: Show session info for manual entries */}
            {Object.values(recordsMap).some(r => r.sessionType === 'cumulative') && (
              <Card className="mb-4 p-3 bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-700">
                  <strong>Manual Entry</strong> — Session capacity: <strong>{dateMaxCount}</strong> periods.
                  Set 0 to mark absent. Enter attended count (1-{dateMaxCount}) for present.
                </p>
              </Card>
            )}

            <div className="space-y-3 mb-6">
              {students.map((stu, index) => {
                  const rec = recordsMap[stu.id];
                  if(!rec) return null;

                  // ✅ FIX: For manual, show attended count (not raw count which may be maxCount for absent)
                  const displayCount = rec.sessionType === 'cumulative'
                    ? (rec.status === 'absent' ? 0 : rec.count)
                    : rec.count;

                  return (
                    <div key={stu.id} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                              {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{stu.name}</p>
                            <p className="text-xs text-gray-500">{stu.studentId}</p>
                            {rec.sessionType === 'cumulative' && (
                               <span className={`text-xs font-medium ${rec.status === 'absent' ? 'text-red-600' : 'text-green-600'}`}>
                                 (Manual — {rec.status === 'absent' ? 'Absent' : `${displayCount}/${dateMaxCount}`})
                               </span>
                            )}
                          </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {rec.sessionType === 'cumulative' ? (
                           <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-gray-400"/>
                              <input 
                                  type="number"
                                  min="0"
                                  max={dateMaxCount}
                                  value={displayCount}
                                  onChange={(e) => updateCount(stu.id, e.target.value)}
                                  className="w-16 px-2 py-1 border rounded text-center"
                              />
                              <span className="text-xs text-gray-400">/ {dateMaxCount}</span>
                           </div>
                        ) : (
                           <div className="flex gap-2">
                              <button 
                                onClick={() => toggleStatus(stu.id)}
                                className={`p-2 rounded ${rec.status === 'present' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                              >
                                <CheckCircle className="w-5 h-5"/>
                              </button>
                              <button 
                                onClick={() => toggleStatus(stu.id)}
                                className={`p-2 rounded ${rec.status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100'}`}
                              >
                                <XCircle className="w-5 h-5"/>
                              </button>
                           </div>
                        )}
                      </div>
                    </div>
                  );
              })}
              
              <Button fullWidth onClick={handleSave} loading={saving} icon={Save}>Save Changes</Button>
            </div>
          </>
        )}

        {/* Show message when no records loaded yet */}
        {students.length > 0 && selectedDate && Object.keys(recordsMap).length === 0 && !loading && (
          <Card className="text-center py-8">
            <p className="text-gray-500">No records found. Click "Load" to fetch data.</p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default EditAttendance;
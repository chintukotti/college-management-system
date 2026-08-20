import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UserCheck, Save } from 'lucide-react';
import { getStudentsByClass, getClassCRs, assignCRs } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ManageCRs = () => {
  const { classId } = useParams();
  const [students, setStudents] = useState([]);
  const [selectedCRs, setSelectedCRs] = useState([]); // Store IDs
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [classId]);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, crsRes] = await Promise.all([
      getStudentsByClass(classId),
      getClassCRs(classId)
    ]);

    if (studentsRes.success) setStudents(studentsRes.data);
    if (crsRes.success) setSelectedCRs(crsRes.data.map(c => c.id)); // Set initial CR IDs
    setLoading(false);
  };

  const toggleCR = (studentId) => {
    if (selectedCRs.includes(studentId)) {
      setSelectedCRs(prev => prev.filter(id => id !== studentId));
    } else {
      if (selectedCRs.length >= 4) {
        toast.error("Maximum 4 CRs allowed");
        return;
      }
      setSelectedCRs(prev => [...prev, studentId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await assignCRs(classId, selectedCRs);
    if (res.success) {
      toast.success("CRs assigned successfully!");
    } else {
      toast.error(res.error);
    }
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/admin/classes" className="inline-flex items-center text-gray-600 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Manage Class Representatives</h1>
          <Button onClick={handleSave} loading={saving} icon={Save}>Save Changes</Button>
        </div>

        <Card className="mb-4 bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700">Select up to 4 students to act as Class Representatives (CRs). They will be able to take daily class attendance.</p>
        </Card>

        <div className="grid gap-3">
          {students.map(student => (
            <div 
              key={student.id}
              onClick={() => toggleCR(student.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${
                selectedCRs.includes(student.id) 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div>
                <h3 className="font-medium text-gray-800">{student.name}</h3>
                <p className="text-sm text-gray-500">{student.studentId}</p>
              </div>
              {selectedCRs.includes(student.id) && (
                <div className="text-green-600 font-medium flex items-center gap-1">
                  <UserCheck className="w-5 h-5" /> CR
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ManageCRs;
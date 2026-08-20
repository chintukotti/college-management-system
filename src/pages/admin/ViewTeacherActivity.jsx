// src/pages/admin/ViewTeacherActivity.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { getTeacherActivity } from '../../firebase/services';
import { createActivityExcel } from '../../utils/excelUtils';
import { db } from '../../firebase/config'; // Import db
import { doc, getDoc } from 'firebase/firestore'; // Import doc, getDoc
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ViewTeacherActivity = () => {
  const { teacherId } = useParams();
  const [logs, setLogs] = useState([]);
  const [groupedLogs, setGroupedLogs] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // NEW: State for Teacher Name
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [teacherId]);

  const fetchLogs = async () => {
      setLoading(true);
      
      // NEW: Fetch Teacher Name
      try {
          const userRef = doc(db, 'users', teacherId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              setTeacherName(userSnap.data().name || 'Unknown Teacher');
          } else {
              setTeacherName('Unknown Teacher');
          }
      } catch (err) {
          console.error("Error fetching teacher info:", err);
          setTeacherName('Error loading name');
      }

      // Fetch Activity Logs
      const res = await getTeacherActivity(teacherId, 'all'); 
      if(res.success) {
          setLogs(res.data);
          const grouped = res.data.reduce((acc, log) => {
              const key = `${log.subjectName || 'Unknown Subject'} - ${log.className || 'Unknown Class'}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(log);
              return acc;
          }, {});
          setGroupedLogs(grouped);
      }
      setLoading(false);
  };

  const handleExport = () => {
      if(logs.length === 0) {
          toast.error("No data to export");
          return;
      }
      // Use teacherName in filename
      createActivityExcel(logs, `Teacher_${teacherName}`);
      toast.success("Excel Downloaded");
  };

  if (loading) return <Loading />;
  const keys = Object.keys(groupedLogs);

  return (
    <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Link to="/admin/teachers" className="inline-flex items-center text-gray-600 mb-2"><ArrowLeft className="w-4 h-4 mr-1"/> Back</Link>
                    <h1 className="text-2xl font-bold text-gray-800">Teacher Activity Log</h1>
                    {/* UPDATED: Display Teacher Name */}
                    <p className="text-gray-500 text-sm">{teacherName || 'Loading...'}</p>
                </div>
                <Button icon={Download} onClick={handleExport}>Export All</Button>
            </div>

            {keys.length === 0 ? (
                <Card className="text-center py-12">No activity logs found.</Card>
            ) : (
                <div className="space-y-4">
                    {keys.map(key => (
                         <Card key={key} className="p-0 overflow-hidden">
                            <button 
                                onClick={() => setExpandedClass(expandedClass === key ? null : key)}
                                className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                            >
                                <span className="font-bold text-gray-700">{key}</span>
                                {expandedClass === key ? <ChevronUp/> : <ChevronDown/>}
                            </button>
                            {expandedClass === key && (
                                <div className="p-4 border-t space-y-2">
                                    {groupedLogs[key].map(log => (
                                        <div key={log.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                                            <Calendar className="w-4 h-4 text-blue-500"/>
                                            <div>
                                                <p className="font-medium">{log.date}</p>
                                                <p className="text-xs text-gray-500">{log.unit} | {log.topic}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </Card>
                    ))}
                </div>
            )}
        </main>
    </div>
  );
};

export default ViewTeacherActivity;
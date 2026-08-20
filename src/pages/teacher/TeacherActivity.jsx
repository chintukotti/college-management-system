import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Calendar, Users, Plus, Edit2, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  getTeacherActivity, 
  logTeacherActivity, 
  updateTeacherActivity, 
  deleteTeacherActivity,
  getSubjectsByTeacher,
  updateAttendanceForActivityLog
} from '../../firebase/services';
import { createActivityExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';

const TeacherActivity = () => {
  const { subjectId } = useParams();
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [groupedLogs, setGroupedLogs] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentLog, setCurrentLog] = useState(null);
  const [formData, setFormData] = useState({ date: '', unit: '', topic: '', className: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchInitialData(); }, [subjectId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [logRes, subRes] = await Promise.all([
      getTeacherActivity(currentUser.uid, subjectId),
      getSubjectsByTeacher(currentUser.uid)
    ]);
    
    if (logRes.success) {
        setLogs(logRes.data);
        const grouped = logRes.data.reduce((acc, log) => {
            const cls = log.className || 'Unknown Class';
            if (!acc[cls]) acc[cls] = [];
            acc[cls].push(log);
            return acc;
        }, {});
        setGroupedLogs(grouped);
    }
    
    if (subRes.success) setSubjects(subRes.data);
    setLoading(false);
  };

  const handleExport = () => {
    if (logs.length === 0) { toast.error("No activity to export"); return; }
    const sub = subjects.find(s => s.id === subjectId);
    createActivityExcel(logs, sub?.name || 'Subject');
    toast.success("Excel Downloaded");
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ date: getTodayDate(), unit: '', topic: '', className: '' });
    setShowModal(true);
  };

  const openEditModal = (log) => {
    setModalMode('edit');
    setCurrentLog(log);
    setFormData({ date: log.date, unit: log.unit || '', topic: log.topic || '', className: log.className || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
        if (modalMode === 'add') {
            await logTeacherActivity({
                teacherId: currentUser.uid, teacherName: currentUser.name,
                subjectId: subjectId, subjectName: subjects.find(s => s.id === subjectId)?.name,
                ...formData
            });
            toast.success("Log Added");
        } else {
            await updateTeacherActivity(currentLog.id, formData);
            
            const unitChanged = (formData.unit || '') !== (currentLog.unit || '');
            const topicChanged = (formData.topic || '') !== (currentLog.topic || '');
            
            if (unitChanged || topicChanged) {
                let classId = currentLog.classId || null;
                if (!classId && currentLog.className) {
                    const subject = subjects.find(s => s.id === subjectId);
                    if (subject?.classes) {
                        const cls = subject.classes.find(c => c.className === currentLog.className);
                        classId = cls?.classId || null;
                    }
                }

                const attResult = await updateAttendanceForActivityLog(
                    subjectId,
                    currentLog.date,
                    formData.unit,
                    formData.topic,
                    classId
                );

                if (attResult.success && attResult.updatedCount > 0) {
                    toast.success(`Log Updated & ${attResult.updatedCount} attendance record(s) synced`);
                } else if (attResult.success) {
                    toast.success("Log Updated (no matching attendance records found)");
                } else {
                    toast.success("Log Updated (attendance sync failed)");
                }
            } else {
                toast.success("Log Updated");
            }
        }
        setShowModal(false);
        fetchInitialData();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this log?")) return;
    const res = await deleteTeacherActivity(id);
    if(res.success) {
        toast.success("Deleted");
        fetchInitialData();
    } else { toast.error("Error deleting"); }
  };

  if (loading) return <Loading />;
  const classNames = Object.keys(groupedLogs);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        
        <div className="mb-1 sm:mb-2">
            <Link to={`/teacher/subject/${subjectId}`} className="inline-flex items-center text-gray-600 hover:text-gray-800 text-xs sm:text-sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Link>
        </div>

        <div className="flex flex-row justify-between items-center gap-2 mb-6">
            <h1 className="text-base sm:text-2xl font-bold text-gray-800 tracking-tight whitespace-nowrap">
                My Activity Log
            </h1>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button 
                  onClick={openAddModal}
                  className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1.5 sm:px-4 sm:py-2 rounded-md font-semibold text-[10px] sm:text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" /> 
                  <span>Add Log</span>
                </button>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-1 bg-white text-gray-700 border border-gray-300 px-2 py-1.5 sm:px-4 sm:py-2 rounded-md font-semibold text-[10px] sm:text-sm hover:bg-gray-50 transition shadow-sm whitespace-nowrap"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" /> 
                  <span>Export</span>
                </button>
            </div>
        </div>

        {classNames.length === 0 ? (
            <Card className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm sm:text-base">No activity logs found.</p>
                <Button className="mt-4" icon={Plus} onClick={openAddModal}>Add First Log</Button>
            </Card>
        ) : (
            <div className="space-y-4">
                {classNames.map(clsName => (
                    <Card key={clsName} className="overflow-hidden p-0">
                        <button 
                            onClick={() => setExpandedClass(expandedClass === clsName ? null : clsName)}
                            className="w-full p-3.5 sm:p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 max-w-[85%] text-left">
                                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0"/>
                                <span className="font-bold text-sm sm:text-base text-gray-700 truncate">{clsName}</span>
                                <span className="text-[10px] sm:text-xs text-gray-400 font-normal flex-shrink-0">({groupedLogs[clsName].length})</span>
                            </div>
                            {expandedClass === clsName ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5"/> : <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5"/>}
                        </button>

                        {expandedClass === clsName && (
                            <div className="p-3 sm:p-4 border-t space-y-2.5">
                                {groupedLogs[clsName].map(log => (
                                    <div key={log.id} className="flex justify-between items-center bg-white p-2.5 sm:p-3 rounded border gap-3">
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                                                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-xs sm:text-sm text-gray-800">{log.date}</p>
                                                <p className="text-xs text-gray-600 truncate">
                                                    <span className="font-semibold text-blue-600">{log.unit || 'N/A'}</span> <span className="text-gray-300">|</span> {log.topic || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-1.5 flex-shrink-0">
                                            <button 
                                              onClick={() => openEditModal(log)}
                                              className="p-1.5 sm:p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-800 rounded transition"
                                              title="Edit Log"
                                            >
                                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            </button>
                                            <button 
                                              onClick={() => handleDelete(log.id)}
                                              className="p-1.5 sm:p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded transition"
                                              title="Delete Log"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            </button>
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

      {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <Card className="w-full max-w-md my-auto max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">{modalMode === 'add' ? 'Add New Log' : 'Edit Log'}</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      {/* ✅ Date disabled in edit mode, enabled in add mode */}
                      <Input 
                        label="Date" 
                        type="date" 
                        value={formData.date} 
                        onChange={e => setFormData({...formData, date: e.target.value})} 
                        required 
                        disabled={modalMode === 'edit'}
                      />
                      <Input label="Unit" placeholder="e.g. Unit 1" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                      <Input label="Topic Covered" placeholder="e.g. Intro" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                      <Input label="Class" placeholder="e.g. CSE 3A" value={formData.className} disabled />

                      <div className="flex gap-2 pt-4">
                          <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                          <Button type="submit" icon={Save} loading={saving} className="flex-1">{modalMode === 'add' ? 'Save' : 'Update'}</Button>
                      </div>
                  </form>
              </Card>
          </div>
      )}
    </div>
  );
};

export default TeacherActivity;
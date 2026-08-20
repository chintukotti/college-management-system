import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Plus, Trash2, Calendar, Hash, Edit2, Users, ChevronDown, Upload, FileSpreadsheet, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { getSemesterById, createSubject, getSubjectsBySemester, getUsersByRole, deleteSubject, updateSubject, getAllClasses, createSubjectsFromExcel } from '../../firebase/services';
import { readExcelFile, downloadSubjectSampleExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

// Helper function for name matching (copied from services.js for client-side preview)
const getNameMatchScore = (dbTeacherName, excelTeacherName) => {
  if (!dbTeacherName || !excelTeacherName) return 0;
  
  const normalize = (name) => {
    if (!name) return '';
    let normalized = name.trim();
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
    normalized = normalized.toLowerCase();
    normalized = normalized.replace(/\./g, '');
    normalized = normalized.replace(/\b(mr|mrs|ms|miss|dr|prof|professor|sir|madam|smt|sri|shri)\b/gi, '');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  };
  
  const normalizedDB = normalize(dbTeacherName);
  const normalizedExcel = normalize(excelTeacherName);
  
  if (normalizedDB === normalizedExcel) return 100;
  
  const dbWords = normalizedDB.split(/\s+/).filter(w => w.length > 0);
  const excelWords = normalizedExcel.split(/\s+/).filter(w => w.length > 0);
  
  if (excelWords.length === 0 || dbWords.length === 0) return 0;
  
  let score = 0;
  let matchedExcelWords = 0;
  
  excelWords.forEach(ew => {
    let bestMatchForThisWord = 0;
    
    dbWords.forEach(dw => {
      if (dw === ew) {
        bestMatchForThisWord = Math.max(bestMatchForThisWord, 10);
      }
      else if (dw.includes(ew) && ew.length >= 3) {
        bestMatchForThisWord = Math.max(bestMatchForThisWord, 7);
      }
      else if (ew.includes(dw) && dw.length >= 3) {
        bestMatchForThisWord = Math.max(bestMatchForThisWord, 7);
      }
      else if (ew.length === 1 && dw.startsWith(ew)) {
        bestMatchForThisWord = Math.max(bestMatchForThisWord, 3);
      }
      else if (dw.length === 1 && ew.startsWith(dw)) {
        bestMatchForThisWord = Math.max(bestMatchForThisWord, 3);
      }
      else if (ew.length >= 4 && dw.length >= 4) {
        if (ew.substring(0, 3) === dw.substring(0, 3)) {
          bestMatchForThisWord = Math.max(bestMatchForThisWord, 5);
        }
      }
    });
    
    if (bestMatchForThisWord > 0) {
      matchedExcelWords++;
      score += bestMatchForThisWord;
    }
  });
  
  if (matchedExcelWords === excelWords.length && excelWords.length >= 2) {
    score += 15;
  }
  
  if (matchedExcelWords < excelWords.length) {
    score = Math.floor(score * 0.7);
  }
  
  return score;
};

const AdminSemesterDetails = () => {
  const { semesterId } = useParams();
  const { currentUser } = useAuth();
  const [semester, setSemester] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newSubject, setNewSubject] = useState({ name: '', code: '', teacherId: '' });

  // Edit State
  const [editingSubject, setEditingSubject] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', code: '', teacherId: '' });

  // Assign Classes State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningSubject, setAssigningSubject] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  // Excel Upload State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [, setExcelFile] = useState(null);
  const [parsedExcelData, setParsedExcelData] = useState(null);
  const [excelValidation, setExcelValidation] = useState(null);
  const [excelProcessing, setExcelProcessing] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState(null);

  // Searchable Dropdown State
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const teacherInputRef = useRef(null);

  // For Edit Modal
  const [editTeacherSearch, setEditTeacherSearch] = useState('');
  const [showEditTeacherDropdown, setShowEditTeacherDropdown] = useState(false);
  const editTeacherInputRef = useRef(null);

  useEffect(() => { fetchData(); }, [semesterId]);
  
  const fetchData = async () => {
    try {
      const [semRes, subRes, teachRes, classRes] = await Promise.all([
        getSemesterById(semesterId),
        getSubjectsBySemester(semesterId),
        getUsersByRole('teacher', currentUser.uid),
        getAllClasses(currentUser.uid)
      ]);
      
      if (semRes.success) setSemester(semRes.data);
      if (subRes.success) setSubjects(subRes.data);
      if (teachRes.success) setTeachers(teachRes.data);
      if (classRes.success) setAllClasses(classRes.data);

    } catch (err) {
      console.error(err);
      toast.error("Error fetching data");
    }
    setLoading(false);
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const filteredEditTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(editTeacherSearch.toLowerCase())
  );

  // --- Handlers ---

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if(!newSubject.teacherId || !newSubject.name) {
        toast.error("Please select a teacher");
        return;
    }
    setSubmitting(true);
    const teacher = teachers.find(t => t.id === newSubject.teacherId);
    const res = await createSubject({
      name: newSubject.name, code: newSubject.code, semesterId, semesterName: semester?.name,
      teacherId: newSubject.teacherId, teacherName: teacher?.name, classes: []
    }, currentUser.uid);
    
    if(res.success) {
      toast.success('Subject Added');
      setNewSubject({ name: '', code: '', teacherId: '' });
      setTeacherSearch('');
      setShowAddSubject(false);
      fetchData(); 
    } else toast.error(res.error);
    setSubmitting(false);
  };

  const openEditModal = (subject) => {
    setEditingSubject(subject);
    setEditFormData({ name: subject.name, code: subject.code, teacherId: subject.teacherId });
    const currentTeacher = teachers.find(t => t.id === subject.teacherId);
    setEditTeacherSearch(currentTeacher ? currentTeacher.name : '');
    setShowEditTeacherDropdown(false);
  };

  const handleUpdateSubject = async () => {
    if(!editFormData.teacherId) {
        toast.error("Please select a teacher");
        return;
    }
    setSubmitting(true);
    const teacher = teachers.find(t => t.id === editFormData.teacherId);
    const res = await updateSubject(editingSubject.id, {
      name: editFormData.name,
      code: editFormData.code,
      teacherId: editFormData.teacherId,
      teacherName: teacher?.name
    });
    if(res.success) {
      toast.success("Subject Updated");
      setSubjects(prev => prev.map(s => s.id === editingSubject.id ? {...s, ...editFormData, teacherName: teacher?.name} : s));
      setEditingSubject(null);
    } else toast.error(res.error);
    setSubmitting(false);
  };

  // Assign Classes Logic
  const openAssignModal = (subject) => {
    setAssigningSubject(subject);
    setSelectedClasses(subject.classes ? subject.classes.map(c => c.classId) : []);
    setShowAssignModal(true);
  };

  const handleClassToggle = (classId) => {
    setSelectedClasses(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleSaveAssignedClasses = async () => {
    setSubmitting(true);
    const classObjects = selectedClasses.map(id => {
      const cls = allClasses.find(c => c.id === id);
      return { classId: id, className: cls?.name || 'Unknown' };
    });

    const res = await updateSubject(assigningSubject.id, { classes: classObjects });
    
    if (res.success) {
      toast.success("Classes assigned successfully");
      setSubjects(prev => prev.map(s => s.id === assigningSubject.id ? {...s, classes: classObjects} : s));
      setShowAssignModal(false);
      setAssigningSubject(null);
    } else {
      toast.error(res.error);
    }
    setSubmitting(false);
  };

  // Excel Upload Handlers
  const handleExcelFileSelect = async (file) => {
    setExcelFile(file);
    setParsedExcelData(null);
    setExcelValidation(null);
    setExcelResult(null);

    if (!file) return;

    setExcelProcessing(true);
    try {
      const data = await readExcelFile(file);
      
      if (data.length === 0) {
        setExcelValidation({ valid: false, errors: ['Excel file is empty'] });
      } else {
        const firstRow = data[0];
        const headers = Object.keys(firstRow);
        const requiredColumns = ['Subject', 'Subject Code', 'Teacher'];
        const missingCols = requiredColumns.filter(col => 
          !headers.some(h => h.trim().toLowerCase() === col.toLowerCase())
        );

        if (missingCols.length > 0) {
          setExcelValidation({ 
            valid: false, 
            errors: [`Missing columns: ${missingCols.join(', ')}. Required: ${requiredColumns.join(', ')}`] 
          });
        } else {
          const validData = [];
          const rowErrors = [];

          data.forEach((row, index) => {
            const subjectName = (row.Subject || '').trim();
            const subjectCode = (row['Subject Code'] || '').trim();
            const excelTeacherName = (row.Teacher || '').trim();

            if (!subjectName) { rowErrors.push(`Row ${index + 2}: Missing Subject name`); return; }
            if (!subjectCode) { rowErrors.push(`Row ${index + 2}: Missing Subject Code`); return; }
            if (!excelTeacherName) { rowErrors.push(`Row ${index + 2}: Missing Teacher name`); return; }

            // ✅ MATCH TEACHER HERE (with lower threshold)
            let matchedTeacher = null;
            let bestScore = 0;

            teachers.forEach(teacher => {
              const score = getNameMatchScore(teacher.name, excelTeacherName);
              if (score > bestScore) {
                bestScore = score;
                matchedTeacher = teacher;
              }
            });

            let matchStatus = 'none';
            if (bestScore === 100) matchStatus = 'exact';
            else if (bestScore >= 3) matchStatus = 'fuzzy';  // ✅ Lowered from 20 to 3

            validData.push({ 
              subjectName, 
              subjectCode: subjectCode.toUpperCase(), 
              teacherName: excelTeacherName,
              matchedTeacherId: matchedTeacher?.id || null,
              matchedTeacherName: matchedTeacher?.name || 'No Match',
              matchStatus,
              matchScore: bestScore
            });
          });

          if (rowErrors.length === 0) {
            setParsedExcelData(validData);
            setExcelValidation({ valid: true, data: validData, errors: [] });
            toast.success(`${validData.length} valid rows found`);
          } else {
            setExcelValidation({ valid: false, errors: rowErrors });
          }
        }
      }
    } catch (error) {
      toast.error(error.message);
      setExcelFile(null);
    }
    setExcelProcessing(false);
  };

  const handleExcelSubmit = async () => {
    if (!excelValidation?.valid || !parsedExcelData?.length) {
      toast.error('Please upload a valid Excel file');
      return;
    }

    setExcelUploading(true);
    
    // ✅ Transform data to match what createSubjectsFromExcel expects
    const formattedData = parsedExcelData.map(row => ({
      Subject: row.subjectName,
      'Subject Code': row.subjectCode,
      Teacher: row.teacherName,
      matchedTeacherId: row.matchedTeacherId,
      matchedTeacherName: row.matchedTeacherName,
      matchStatus: row.matchStatus
    }));

    const result = await createSubjectsFromExcel(
      formattedData,
      semesterId,
      semester?.name || 'Unknown Semester',
      currentUser.uid
    );

    if (result.success) {
      let msg = `${result.created.length}/${result.totalCount} subjects created successfully!`;
      if (result.errors.length > 0) {
        msg += ` (${result.errors.length} errors)`;
      }
      if (result.skippedDuplicates.length > 0) {
        msg += ` (${result.skippedDuplicates.length} duplicates)`;
      }
      toast.success(msg);
      
      setShowExcelModal(false);
      setExcelFile(null);
      setParsedExcelData(null);
      setExcelValidation(null);
      setExcelResult(result);
      fetchData();
    } else {
      toast.error(result.error);
    }
    setExcelUploading(false);
  };

  const getMatchIcon = (status) => {
    if (status === 'exact') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'fuzzy') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
             <div>
                <Link to="/admin/semesters" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">{semester?.name}</h1>
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" /> {semester?.startDate} - {semester?.endDate}
                </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setShowAddSubject(!showAddSubject)}>
                {showAddSubject ? 'Cancel' : 'Add Subject'}
              </Button>
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => setShowExcelModal(true)}>
                Upload Excel
              </Button>
            </div>
        </div>

        {/* Add Subject Form */}
        {showAddSubject && (
             <Card className="mb-8 bg-blue-50 border-blue-200">
             <h3 className="font-bold text-gray-800 mb-4">Add Subject</h3>
             <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Input label="Subject Name" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} required placeholder="e.g. Mathematics" icon={BookOpen} />
               <Input label="Subject Code" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} required placeholder="e.g. MATH101" icon={Hash} />
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                 <div className="relative" ref={teacherInputRef}>
                    <input 
                        type="text"
                        placeholder="Select or search..."
                        value={teacherSearch}
                        onChange={(e) => {
                            setTeacherSearch(e.target.value);
                            setNewSubject({...newSubject, teacherId: ''});
                        }}
                        onFocus={() => setShowTeacherDropdown(true)}
                        onBlur={() => setTimeout(() => setShowTeacherDropdown(false), 200)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-5 h-5 text-gray-400"/>
                    </div>

                    {showTeacherDropdown && (
                        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                            {filteredTeachers.length > 0 ? (
                                filteredTeachers.map(t => (
                                    <div 
                                        key={t.id} 
                                        className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 ${newSubject.teacherId === t.id ? 'bg-blue-100' : ''}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setNewSubject({...newSubject, teacherId: t.id});
                                            setTeacherSearch(t.name);
                                            setShowTeacherDropdown(false);
                                        }}
                                    >
                                        {t.name}
                                    </div>
                                ))
                            ) : (
                                <p className="px-4 py-2 text-gray-500 text-sm">No teacher found</p>
                            )}
                        </div>
                    )}
                 </div>
               </div>

               <div className="md:col-span-3 flex justify-end">
                 <Button type="submit" loading={submitting} icon={Plus}>Add Subject</Button>
               </div>
             </form>
           </Card>
        )}

        {/* Subjects List */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Subjects ({subjects.length})</h2>

        {/* Excel Upload Result Banner */}
        {excelResult && (
          <div className={`mb-4 p-3 rounded-lg border ${
            excelResult.created.length > 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  {excelResult.created.length}/{excelResult.totalCount} subjects created via Excel
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(excelResult.errors.length > 0 || excelResult.skippedDuplicates.length > 0) && (
                  <button 
                    onClick={() => {
                      const allErrors = [
                        ...excelResult.errors.map(e => `❌ ${e}`),
                        ...excelResult.skippedDuplicates.map(e => `⚠️ ${e}`)
                      ];
                      alert(allErrors.join('\n\n'));
                    }}
                    className="text-xs text-red-600 underline hover:text-red-800 font-medium"
                  >
                    {excelResult.errors.length > 0 && `${excelResult.errors.length} errors`}
                    {excelResult.errors.length > 0 && excelResult.skippedDuplicates.length > 0 && ' • '}
                    {excelResult.skippedDuplicates.length > 0 && `${excelResult.skippedDuplicates.length} duplicates`}
                  </button>
                )}
                <button 
                  onClick={() => setExcelResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.length === 0 ? (
            <Card className="text-center py-8 col-span-2">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No subjects.</p>
            </Card>
          ) : (
            subjects.map(sub => (
              <Card key={sub.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{sub.name}</h3>
                    {/* ✅ Code and Teacher in same row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-500 font-mono">{sub.code}</span>
                      <span className="text-gray-300">•</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {sub.teacherName || 'No teacher'}
                      </span>
                    </div>
                    {/* ✅ Removed "Was" label */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {sub.classes && sub.classes.map(c => (
                            <span key={c.classId} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                {c.className}
                            </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2 self-start">
                    <Button variant="secondary" size="sm" icon={Users} onClick={() => openAssignModal(sub)}>
                        Classes
                    </Button>
                    <Button variant="secondary" size="sm" icon={Edit2} onClick={() => openEditModal(sub)} />
                    <Button variant="danger" size="sm" icon={Trash2} onClick={async () => {
                        if(window.confirm('Delete subject?')) { await deleteSubject(sub.id); fetchData(); }
                    }} />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Edit Subject Modal */}
      {editingSubject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <Card className="w-full max-w-md my-auto max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">Edit Subject</h2>
                  <div className="space-y-4">
                      <Input label="Name" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                      <Input label="Code" value={editFormData.code} onChange={e => setEditFormData({...editFormData, code: e.target.value})} />
                      
                      <div>
                          <label className="block text-sm font-medium mb-1">Teacher</label>
                          <div className="relative" ref={editTeacherInputRef}>
                            <input 
                                type="text"
                                placeholder="Search teacher..."
                                value={editTeacherSearch}
                                onChange={(e) => {
                                    setEditTeacherSearch(e.target.value);
                                    setEditFormData({...editFormData, teacherId: ''});
                                }}
                                onFocus={() => setShowEditTeacherDropdown(true)}
                                onBlur={() => setTimeout(() => setShowEditTeacherDropdown(false), 200)}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown className="w-5 h-5 text-gray-400"/>
                            </div>
                            
                            {showEditTeacherDropdown && (
                                <div className="absolute z-20 w-full bg-white border rounded-lg mt-1 max-h-32 overflow-y-auto shadow-lg">
                                    {filteredEditTeachers.length > 0 ? (
                                        filteredEditTeachers.map(t => (
                                            <div 
                                                key={t.id} 
                                                className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 ${editFormData.teacherId === t.id ? 'bg-blue-100' : ''}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setEditFormData({...editFormData, teacherId: t.id});
                                                    setEditTeacherSearch(t.name);
                                                    setShowEditTeacherDropdown(false);
                                                }}
                                            >
                                                {t.name}
                                            </div>
                                        ))
                                    ) : <p className="px-4 py-2 text-gray-500 text-sm">No match</p>}
                                </div>
                            )}
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <Button variant="secondary" onClick={() => setEditingSubject(null)} className="flex-1">Cancel</Button>
                      <Button onClick={handleUpdateSubject} loading={submitting} className="flex-1">Update</Button>
                  </div>
              </Card>
          </div>
      )}

      {/* Assign Classes Modal */}
      {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md max-h-[80vh] flex flex-col">
                  <h2 className="text-xl font-bold mb-4">Assign Classes to {assigningSubject?.name}</h2>
                  <div className="overflow-y-auto flex-1 mb-4 space-y-2 pr-2">
                      {allClasses.length === 0 ? <p className="text-gray-500 text-center">No classes available.</p> : (
                          allClasses.map(cls => (
                              <label key={cls.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                  <input 
                                      type="checkbox" 
                                      checked={selectedClasses.includes(cls.id)}
                                      onChange={() => handleClassToggle(cls.id)}
                                      className="w-5 h-5 text-blue-600 rounded"
                                  />
                                  <span className="font-medium text-gray-800">{cls.name}</span>
                              </label>
                          ))
                      )}
                  </div>
                  <div className="flex gap-2 border-t pt-4">
                      <Button variant="secondary" onClick={() => setShowAssignModal(false)} className="flex-1">Cancel</Button>
                      <Button onClick={handleSaveAssignedClasses} loading={submitting} className="flex-1">Save</Button>
                  </div>
              </Card>
          </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
              <Card className="w-full max-w-4xl my-8">
                  <div className="flex items-center justify-between mb-6">
                      <div>
                          <h2 className="text-xl font-bold text-gray-800">Upload Subjects via Excel</h2>
                          <p className="text-gray-500 text-sm mt-1">{semester?.name}</p>
                      </div>
                      <button 
                        onClick={() => { setShowExcelModal(false); setExcelFile(null); setParsedExcelData(null); setExcelValidation(null); setExcelResult(null); }}
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                      >
                          ✕
                      </button>
                  </div>

                  {/* Info Box */}
                  <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                              <h4 className="font-medium text-indigo-800">How teacher matching works</h4>
                              <ul className="text-sm text-indigo-600 mt-1 list-disc list-inside">
                                  <li><strong>Exact match:</strong> "Vishnu Priyanka J." = "Vishnu Priyanka J."</li>
                                  <li><strong>Fuzzy match:</strong> "E. Raju" = "Mr. Esai Raju" (partial match)</li>
                                  <li><strong>No match:</strong> Unknown name = teacher not assigned</li>
                              </ul>
                          </div>
                      </div>
                  </div>

                  {/* Download template button */}
                  <div className="mb-4">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={FileSpreadsheet}
                        onClick={downloadSubjectSampleExcel}
                        fullWidth
                      >
                        Download Template
                      </Button>
                  </div>

                  {/* File Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Excel File
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleExcelFileSelect(file);
                      }}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        cursor-pointer border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Required columns: Subject, Subject Code, Teacher
                    </p>
                  </div>

                  {/* Processing spinner */}
                  {excelProcessing && (
                    <div className="my-4 text-center text-gray-400 text-sm">Processing file...</div>
                  )}

                  {/* Validation */}
                  {excelValidation && (
                    <div className="mt-4">
                      {excelValidation.valid ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-green-700 mb-2">
                              <CheckCircle className="w-5 h-5" />
                              <span className="font-medium">Validation Passed!</span>
                          </div>
                          <p className="text-green-600 text-sm">
                              {excelValidation.data.length} rows ready to create
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-700 mb-2">
                              <AlertCircle className="w-5 h-5" />
                              <span className="font-medium">Validation Errors</span>
                          </div>
                          <ul className="text-red-600 text-sm list-disc list-inside max-h-40 overflow-y-auto">
                              {excelValidation.errors.map((error, idx) => (
                                  <li key={idx} className="break-all">{error}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ Preview Table - Shows all subjects in Excel order */}
                  {excelValidation?.valid && excelValidation?.data?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Preview ({excelValidation.data.length} subjects)</h4>
                      <div className="overflow-x-auto border rounded-lg max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Subject</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Excel Teacher</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Matched As</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelValidation.data.map((row, idx) => (
                              <tr key={idx} className="border-t hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium">{row.subjectName}</td>
                                  <td className="px-3 py-2 font-mono text-xs">{row.subjectCode}</td>
                                  <td className="px-3 py-2 text-gray-600">{row.teacherName}</td>
                                  <td className="px-3 py-2">
                                    {row.matchStatus === 'none' ? (
                                      <span className="text-red-500 text-xs font-medium">Not Assigned</span>
                                    ) : (
                                      <span className="text-gray-800">{row.matchedTeacherName}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center flex justify-center">
                                    {getMatchIcon(row.matchStatus)}
                                  </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="secondary"
                      onClick={() => { setShowExcelModal(false); setExcelFile(null); setParsedExcelData(null); setExcelValidation(null); setExcelResult(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleExcelSubmit}
                      loading={excelUploading}
                      disabled={!excelValidation?.valid}
                      icon={Upload}
                      fullWidth
                    >
                      Create {excelValidation?.data?.length || 0} Subjects
                    </Button>
                  </div>
              </Card>
          </div>
      )}
    </div>
  );
};

export default AdminSemesterDetails;
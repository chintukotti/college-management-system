import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  Users,
  IdCard,
  User,
  Edit2,
  Trash2,
  Save,
  X,
  GripVertical,
  ListOrdered,
  Eye,
  Download,
  AlertTriangle,
  ChevronDown, 
  ChevronUp   
} from 'lucide-react';
import {
  getClassById,
  getStudentsByClass,
  updateUser,
  deleteUser,
  updateStudentsOrder,
  getClassLowAttendance,
  recomputeClassAttendanceStats
} from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { createLowAttendanceExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

// DnD Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableStudentItem = ({ student, index, isReorderMode, editingStudent, editForm, setEditForm, handleEdit, handleCancelEdit, handleSaveEdit, handleDelete, saving, deleting, isAdmin }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className={`hover:shadow-md transition-shadow ${isDragging ? 'shadow-lg border-blue-400' : ''}`}>
        {editingStudent === student.id ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600 flex-shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Student ID</label>
                <p className="font-medium text-gray-800">{student.studentId}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                  className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end sm:justify-start flex-shrink-0">
              <Button size="sm" variant="success" onClick={() => handleSaveEdit(student.id)} loading={saving} icon={Save}>Save</Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} icon={X}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {isReorderMode && isAdmin && (
              <button
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${student.name}`}
                className="cursor-grab active:cursor-grabbing p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg touch-none shrink-0"
              >
                <GripVertical className="w-5 h-5" />
              </button>
            )}
            
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600 flex-shrink-0">
              {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">{student.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <IdCard className="w-3 h-3 flex-shrink-0" />
                <span>{student.studentId}</span>
                {student.gender && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{student.gender}</span>
                  </>
                )}
              </div>
            </div>

            {!isReorderMode && (
              <div className="flex gap-2 flex-shrink-0">
                <Link to={`/student/details/${student.id}`}>
                  <Button size="sm" variant="secondary" icon={Eye}>View</Button>
                </Link>
                {isAdmin && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(student)} icon={Edit2} className="hidden sm:inline-flex">Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(student.id, student.name)} loading={deleting === student.id} icon={Trash2} className="hidden sm:inline-flex">Delete</Button>
                  </>
                )}
              </div>
            )}

            {isReorderMode && (
              <span className="text-xs text-gray-400 italic px-2 py-1 hidden sm:inline">Drag to reorder</span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

const ClassStudents = () => {
  const { classId } = useParams();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', gender: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showLowAttendance, setShowLowAttendance] = useState(false);
  const [statsAvailable, setStatsAvailable] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchData();
  }, [classId]);

  useEffect(() => {
    if (!isReorderMode) {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students, isReorderMode]);

  const fetchData = async (force = false) => {
    setLoading(true);
    const [classResult, studentsResult] = await Promise.all([
      getClassById(classId, force),
      getStudentsByClass(classId, force)
    ]);

    if (classResult.success) setClassData(classResult.data);
    if (studentsResult.success) {
      setStudents(studentsResult.data);
      setFilteredStudents(studentsResult.data);
      if(isAdmin) fetchLowAttendance(studentsResult.data);
    }
    setLoading(false);
  };

  const fetchLowAttendance = async (studentList, force = false) => {
    setLoadingStats(true);
    try {
      const res = await getClassLowAttendance(classId, studentList, 75, force);
      if (res.success) {
        setLowAttendanceStudents(res.data);
        setStatsAvailable(res.hasStats);
      }
    } catch (err) {
      console.error('Error fetching low attendance:', err);
      toast.error('Failed to calculate attendance');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRecomputeStats = async () => {
    setRecomputing(true);
    const res = await recomputeClassAttendanceStats(classId);
    if (res.success) {
      toast.success(`Attendance totals rebuilt (${res.recordsScanned} records)`);
      await fetchLowAttendance(students, true);
    } else {
      toast.error(res.error || 'Failed to rebuild totals');
    }
    setRecomputing(false);
  };

  const handleExportLowAttendance = () => {
    if(lowAttendanceStudents.length === 0) {
        toast.error("No low attendance data to export");
        return;
    }
    createLowAttendanceExcel(lowAttendanceStudents, classData?.name);
    toast.success("Excel Downloaded");
  };

  const handleEdit = (student) => {
    setEditingStudent(student.id);
    setEditForm({ name: student.name, gender: student.gender || '' });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditForm({ name: '', gender: '' });
  };

  const handleSaveEdit = async (studentId) => {
    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const result = await updateUser(studentId, { name: editForm.name, gender: editForm.gender });
    if (result.success) {
      toast.success('Student updated successfully');
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, name: editForm.name, gender: editForm.gender } : s));
      setEditingStudent(null);
    } else {
      toast.error('Failed to update student');
    }
    setSaving(false);
  };

  const handleDelete = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete "${studentName}"?`)) return;
    setDeleting(studentId);
    const result = await deleteUser(studentId);
    if (result.success) {
      toast.success('Student deleted successfully');
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } else {
      toast.error('Failed to delete student');
    }
    setDeleting(null);
  };

  const enterReorderMode = () => {
    setReorderList([...students]);
    setIsReorderMode(true);
    setSearchTerm('');
  };

  const exitReorderMode = () => {
    setIsReorderMode(false);
    setReorderList([]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setReorderList((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    const studentIds = reorderList.map(s => s.id);
    const result = await updateStudentsOrder(classId, studentIds);
    if (result.success) {
      toast.success('Student order saved!');
      setStudents(reorderList);
      setIsReorderMode(false);
    } else {
      toast.error('Failed to save order');
    }
    setSavingOrder(false);
  };

  const displayList = isReorderMode ? reorderList : filteredStudents;

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-6">
          <Link to={-1} className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-3 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{classData?.name}</h1>
              <p className="text-gray-600 mt-1 font-medium">{students.length} student{students.length !== 1 ? 's' : ''} in this class</p>
            </div>

            {/* Action Buttons with Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar - Only shown when NOT in reorder mode */}
              {!isReorderMode && (
                <div className="relative w-full sm:w-48 order-first lg:order-none">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {isAdmin && (
                <>
                  {lowAttendanceStudents.length > 0 && !isReorderMode && (
                    <Button variant="secondary" size="sm" icon={Download} onClick={handleExportLowAttendance} loading={loadingStats}>
                      Export Low Att.
                    </Button>
                  )}
                  {isReorderMode ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={exitReorderMode} icon={X}>Cancel</Button>
                      <Button size="sm" onClick={saveOrder} loading={savingOrder} icon={Save}>Save Order</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" size="sm" icon={ListOrdered} onClick={enterReorderMode}>Reorder</Button>
                      <Link to={`/admin/class/${classId}/edit`}>
                        <Button size="sm" icon={Edit2}>Edit Class</Button>
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        {isAdmin && !statsAvailable && !isReorderMode && !loadingStats && students.length > 0 && (
          <Card className="mb-6 bg-amber-50 border-2 border-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 flex-1">
                No attendance totals recorded for this class yet. They build up automatically as
                attendance is taken — if this class has older attendance, rebuild them once.
              </p>
              <Button size="sm" variant="secondary" onClick={handleRecomputeStats} loading={recomputing} className="shrink-0">
                Rebuild Totals
              </Button>
            </div>
          </Card>
        )}

        {/* Low Attendance Alert - SMALLER SIZE */}
        {isAdmin && lowAttendanceStudents.length > 0 && !isReorderMode && (
          <Card className="mb-6 bg-red-50 border-2 border-red-200 p-0 overflow-hidden">
            <button 
              onClick={() => setShowLowAttendance(!showLowAttendance)}
              className="w-full p-3 flex items-center justify-between hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-red-900 text-sm">Low Attendance Alert</h2>
                  <p className="text-xs text-red-700 font-medium">{lowAttendanceStudents.length} student{lowAttendanceStudents.length > 1 ? 's' : ''} below 75%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showLowAttendance ? 
                  <ChevronUp className="w-4 h-4 text-red-600" /> : 
                  <ChevronDown className="w-4 h-4 text-red-600" />
                }
              </div>
            </button>

            {showLowAttendance && (
              <div className="p-3 pt-0 border-t-2 border-red-200 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {lowAttendanceStudents.map(student => (
                    <div key={student.id} className="bg-white p-2.5 rounded-lg border border-red-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center text-xs font-bold text-red-600 shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-xs truncate">{student.name}</p>
                          <p className="text-[10px] text-red-600 font-bold">{student.stats.percentage}%</p>
                        </div>
                      </div>
                      <Link to={`/student/details/${student.id}`} className="shrink-0 ml-2">
                        <button className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Reorder Mode Banner */}
        {isReorderMode && (
          <Card className="mb-4 bg-yellow-50 border-2 border-yellow-200 p-3">
            <div className="flex items-start gap-2">
              <GripVertical className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 font-medium">Drag and drop students to set the attendance order.</p>
            </div>
          </Card>
        )}

        {/* Student List */}
        {displayList.length === 0 ? (
          <Card className="text-center py-16 px-4">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">{searchTerm ? 'No students found' : 'No students in this class'}</p>
            {searchTerm && (
              <p className="text-gray-400 text-sm mt-2">Try a different search term</p>
            )}
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayList.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {displayList.map((student, index) => (
                <SortableStudentItem
                  key={student.id}
                  student={student}
                  index={index}
                  isReorderMode={isReorderMode}
                  editingStudent={editingStudent}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  handleEdit={handleEdit}
                  handleCancelEdit={handleCancelEdit}
                  handleSaveEdit={handleSaveEdit}
                  handleDelete={handleDelete}
                  saving={saving}
                  deleting={deleting}
                  isAdmin={isAdmin}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default ClassStudents;
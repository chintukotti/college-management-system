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
            <div className="flex gap-2 justify-end sm:justify-start">
              <Button size="sm" variant="success" onClick={() => handleSaveEdit(student.id)} loading={saving} icon={Save}>Save</Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} icon={X}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-row sm:items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
            {isReorderMode && isAdmin && (
              // Must stay visible on phones — hiding it made reordering
              // impossible on the devices most likely to be used for it.
              <button
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${student.name}`}
                className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg touch-none shrink-0 self-start sm:self-auto"
              >
                <GripVertical className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600 flex-shrink-0">
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-800 truncate">{student.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <IdCard className="w-3 h-3" />
                  <span>{student.studentId}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{student.gender || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end sm:justify-start mt-2 sm:mt-0 border-t sm:border-t-0 pt-2 sm:pt-0">
              {isReorderMode ? (
                <span className="text-xs text-gray-400 italic p-2">Drag to reorder</span>
              ) : (
                <>
                  <Link to={`/student/details/${student.id}`}>
                    <Button size="sm" variant="secondary" icon={Eye}>View</Button>
                  </Link>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => handleEdit(student)} icon={Edit2}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(student.id, student.name)} loading={deleting === student.id} icon={Trash2}>Delete</Button>
                    </>
                  )}
                </>
              )}
            </div>
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

  // Totals are kept on the class document as attendance is taken, so finding
  // who is below 75% is a single document read. Previously this queried every
  // student's whole attendance history — about 19,000 reads for one class.
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

  // One-off backfill for attendance recorded before rollups existed.
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Link to={-1} className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">{classData?.name}</h1>
            <p className="text-gray-600">{students.length} student{students.length !== 1 ? 's' : ''} in this class</p>
          </div>

          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
                 {lowAttendanceStudents.length > 0 && !isReorderMode && (
                    <Button variant="secondary" icon={Download} onClick={handleExportLowAttendance} loading={loadingStats}>
                        Export Low Att.
                    </Button>
                 )}
              {isReorderMode ? (
                <>
                  <Button variant="secondary" onClick={exitReorderMode} icon={X}>Cancel</Button>
                  <Button icon={Save} onClick={saveOrder} loading={savingOrder}>Save Order</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" icon={ListOrdered} onClick={enterReorderMode}>Reorder</Button>
                  <Link to={`/admin/class/${classId}/edit`}>
                    <Button icon={Edit2}>Edit Class</Button>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* Shown only when a class has attendance recorded before rollups
            existed, so its totals have never been calculated. */}
        {isAdmin && !statsAvailable && !isReorderMode && !loadingStats && students.length > 0 && (
          <Card className="mb-6 bg-amber-50 border border-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 flex-1">
                No attendance totals recorded for this class yet. They build up automatically as
                attendance is taken — if this class has older attendance, rebuild them once.
              </p>
              <Button size="sm" variant="secondary" onClick={handleRecomputeStats} loading={recomputing}>
                Rebuild Totals
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && lowAttendanceStudents.length > 0 && !isReorderMode && (
            <Card className="mb-6 bg-red-50 border border-red-200 p-0 overflow-hidden">
                <button 
                    onClick={() => setShowLowAttendance(!showLowAttendance)}
                    className="w-full p-4 flex items-center justify-between hover:bg-red-100 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h2 className="font-bold text-red-800">Low Attendance Alert ({lowAttendanceStudents.length} Students)</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {showLowAttendance ? 
                            <ChevronUp className="w-5 h-5 text-red-600" /> : 
                            <ChevronDown className="w-5 h-5 text-red-600" />
                        }
                    </div>
                </button>

                {showLowAttendance && (
                    <div className="p-4 pt-0 border-t border-red-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                            {lowAttendanceStudents.map(student => (
                                <div key={student.id} className="bg-white p-3 rounded-lg border border-red-100 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-600">
                                            {student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                                            <p className="text-xs text-red-600 font-bold">{student.stats.percentage}%</p>
                                        </div>
                                    </div>
                                    <Link to={`/student/details/${student.id}`}>
                                        <Button size="sm" variant="secondary" icon={Eye}>View</Button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        )}

        {!isReorderMode && (
          <Card className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Card>
        )}

        {isReorderMode && (
          <Card className="mb-4 bg-yellow-50 border-yellow-200 p-3">
            <p className="text-sm text-yellow-700 font-medium">Drag and drop students to set the attendance order.</p>
          </Card>
        )}

        {displayList.length === 0 ? (
          <Card className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{searchTerm ? 'No students found' : 'No students in this class'}</p>
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
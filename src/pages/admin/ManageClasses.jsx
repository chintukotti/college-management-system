import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FolderPlus, Trash2, Users, Calendar, Search, Layers, Eye, Edit2,
  AlertTriangle, Download, ChevronDown, ChevronUp, UserCheck, Save, X, ListOrdered, GripVertical,
  MoreVertical, RefreshCw, TrendingDown
} from 'lucide-react';
import {
  getAllClasses, deleteClass, getStudentsByClass, updateClassesOrder,
  getGlobalLowAttendance, recomputeAllClassesStats
} from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { createGlobalLowAttendanceExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Enhanced color themes for cards - EXACTLY 5 COLORS
const ACCENTS = [
  { 
    bar: 'bg-gradient-to-br from-orange-500 to-orange-600', 
    bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50',
    border: 'border-orange-200',
    hover: 'hover:border-orange-300 hover:shadow-orange-200/50',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700'
  },
  { 
    bar: 'bg-gradient-to-br from-blue-500 to-blue-600', 
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
    border: 'border-blue-200',
    hover: 'hover:border-blue-300 hover:shadow-blue-200/50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700'
  },
  { 
    bar: 'bg-gradient-to-br from-emerald-500 to-emerald-600', 
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
    border: 'border-emerald-200',
    hover: 'hover:border-emerald-300 hover:shadow-emerald-200/50',
    icon: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  { 
    bar: 'bg-gradient-to-br from-violet-500 to-violet-600', 
    bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50',
    border: 'border-violet-200',
    hover: 'hover:border-violet-300 hover:shadow-violet-200/50',
    icon: 'bg-violet-100 text-violet-600',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700'
  },
  { 
    bar: 'bg-gradient-to-br from-rose-500 to-rose-600', 
    bg: 'bg-gradient-to-br from-rose-50 to-rose-100/50',
    border: 'border-rose-200',
    hover: 'hover:border-rose-300 hover:shadow-rose-200/50',
    icon: 'bg-rose-100 text-rose-600',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700'
  },
];

// --- Sortable Class Card Component ---
const SortableClassCard = ({ cls, index, isReorderMode, handleDelete, deleting, matchingStudents, lowCount }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const accent = ACCENTS[index % ACCENTS.length];

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cls.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <div
        onClick={() => !isReorderMode && navigate(`/admin/class/${cls.id}/students`)}
        className={`h-full ${!isReorderMode ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`relative h-full flex flex-col transition-all duration-200 rounded-xl border-2 ${accent.border} ${accent.bg} ${!isReorderMode ? `${accent.hover} hover:shadow-lg` : ''} ${isDragging ? 'shadow-xl border-blue-400' : ''} p-4`}
        >
          {/* Top colored bar */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-xl ${accent.bar}`} />

          <div className="flex items-start justify-between gap-3 mt-1">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {isReorderMode && (
                <div {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none shrink-0 mt-1">
                  <GripVertical className="w-5 h-5" />
                </div>
              )}
              <div className={`p-2.5 rounded-xl shrink-0 ${accent.icon} shadow-sm`}>
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-bold text-gray-900 truncate text-base leading-tight`} title={cls.name}>
                  {cls.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accent.text} whitespace-nowrap`}>
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{cls.studentCount || 0} {cls.studentCount === 1 ? 'student' : 'students'}</span>
                  </span>
                </div>
              </div>
            </div>

            {!isReorderMode && (
              <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="More actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border-2 border-gray-100 py-1.5 z-[100] overflow-hidden">
                    <Link to={`/admin/class/${cls.id}/students`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <Eye className="w-4 h-4" /> View Students
                    </Link>
                    <Link to={`/admin/class/${cls.id}/crs`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <UserCheck className="w-4 h-4" /> Manage CRs
                    </Link>
                    <Link to={`/admin/class/${cls.id}/attendance-report`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <Calendar className="w-4 h-4" /> Attendance Report
                    </Link>
                    <div className="h-px bg-gray-100 my-1.5" />
                    <Link to={`/admin/class/${cls.id}/edit`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <Edit2 className="w-4 h-4" /> Edit Class
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); handleDelete(cls.id, cls.name); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      {deleting === cls.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete Class
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Low Attendance Badge */}
          {lowCount > 0 && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold shadow-sm">
                <TrendingDown className="w-3.5 h-3.5" /> 
                {lowCount} {lowCount === 1 ? 'student' : 'students'} below 75%
              </span>
            </div>
          )}

          {/* Matching students when searching */}
          {matchingStudents && matchingStudents.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Matched Students:</span>
              </div>
              {matchingStudents.slice(0, 2).map((student, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white/80 border border-blue-200 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900 truncate">{student.name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.studentId}</p>
                  </div>
                </div>
              ))}
              {matchingStudents.length > 2 && (
                <div className="px-3 py-1.5 bg-white/60 border border-gray-200 rounded-lg text-center">
                  <span className="text-xs font-semibold text-gray-600">
                    +{matchingStudents.length - 2} more {matchingStudents.length - 2 === 1 ? 'student' : 'students'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const ManageClasses = () => {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const [globalLowAtt, setGlobalLowAtt] = useState([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [showGlobalLowAtt, setShowGlobalLowAtt] = useState(false);
  const [hasFetchedGlobal, setHasFetchedGlobal] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const [studentsFetched, setStudentsFetched] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Student data is only pulled once the admin actually searches for a student
  useEffect(() => {
    if (searchTerm.trim() && !studentsFetched && !isReorderMode && !fetchingStudents) {
      fetchAllStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, isReorderMode]);

  const fetchClasses = async (force = false) => {
    setLoading(true);
    try {
      const result = await getAllClasses(currentUser.uid, force);
      if (result.success) setClasses(result.data);
      else toast.error('Failed to fetch classes');
    } catch (err) {
      console.error('Error fetching classes:', err);
      toast.error('Error fetching classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStudents = async (force = false) => {
    if (fetchingStudents) return;
    setFetchingStudents(true);
    try {
      const entries = await Promise.all(
        classes.map(async (cls) => {
          const res = await getStudentsByClass(cls.id, force);
          return [cls.id, res.success ? res.data : []];
        })
      );
      setClassStudents(Object.fromEntries(entries));
      setStudentsFetched(true);
    } catch (err) {
      console.error('Error fetching students:', err);
      toast.error('Error loading students');
    } finally {
      setFetchingStudents(false);
    }
  };

  const fetchGlobalLowAttendance = async (force = false) => {
    setLoadingGlobal(true);
    try {
      const res = await getGlobalLowAttendance(currentUser.uid, 75, force);
      if (res.success) {
        setGlobalLowAtt(res.data);
        setHasFetchedGlobal(true);
      } else {
        toast.error('Error scanning attendance');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error scanning attendance');
    } finally {
      setLoadingGlobal(false);
    }
  };

  const toggleGlobalAtt = (state) => {
    setShowGlobalLowAtt(state);
    if (state && !hasFetchedGlobal && !loadingGlobal) fetchGlobalLowAttendance();
  };

  const handleRebuildStats = async () => {
    if (!window.confirm('Rebuild attendance totals for every class?\n\nThis reads all existing attendance records once, and is only needed for attendance taken before totals were tracked automatically.')) return;
    setRebuilding(true);
    const res = await recomputeAllClassesStats(currentUser.uid);
    if (res.success) {
      toast.success(`Rebuilt ${res.classesDone} class(es) from ${res.recordsScanned} records`);
      await fetchGlobalLowAttendance(true);
    } else {
      toast.error(res.error || 'Failed to rebuild totals');
    }
    setRebuilding(false);
  };

  const handleExportGlobal = () => {
    if (globalLowAtt.length === 0) { toast.error('No data to export'); return; }
    createGlobalLowAttendanceExcel(globalLowAtt);
    toast.success('Excel downloaded');
  };

  const handleDelete = async (classId, className) => {
    if (!window.confirm(`Delete "${className}"?\n\nThis also removes every student in it.`)) return;
    setDeleting(classId);
    const result = await deleteClass(classId);
    if (result.success) {
      toast.success('Class deleted');
      setClasses(prev => prev.filter(c => c.id !== classId));
      setClassStudents(prev => {
        const next = { ...prev };
        delete next[classId];
        return next;
      });
    } else {
      toast.error('Failed to delete');
    }
    setDeleting(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const enterReorderMode = () => {
    setReorderList([...classes]);
    setIsReorderMode(true);
    setSearchTerm('');
  };

  const exitReorderMode = () => {
    setIsReorderMode(false);
    setReorderList([]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderList((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    const result = await updateClassesOrder(reorderList.map(c => c.id));
    if (result.success) {
      toast.success('Class order saved');
      setClasses(reorderList);
      setIsReorderMode(false);
    } else {
      toast.error('Failed to save order');
    }
    setSavingOrder(false);
  };

  const getMatchingStudents = (classId) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;
    return (classStudents[classId] || []).filter(student =>
      (student.name || '').toLowerCase().includes(term) ||
      (student.studentId || '').toLowerCase().includes(term)
    );
  };

  const lowCountByClass = useMemo(() => {
    return globalLowAtt.reduce((acc, student) => {
      if (student.classId) acc[student.classId] = (acc[student.classId] || 0) + 1;
      return acc;
    }, {});
  }, [globalLowAtt]);

  const filteredClasses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return classes;
    if (!studentsFetched) return classes;
    return classes.filter(cls =>
      (classStudents[cls.id] || []).some(student =>
        (student.name || '').toLowerCase().includes(term) ||
        (student.studentId || '').toLowerCase().includes(term)
      )
    );
  }, [searchTerm, classes, classStudents, studentsFetched]);

  const totalStudents = useMemo(
    () => classes.reduce((sum, cls) => sum + (cls.studentCount || 0), 0),
    [classes]
  );

  const displayList = isReorderMode ? reorderList : filteredClasses;

  const ClassGridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <div key={i} className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
          <div className="animate-pulse">
            <div className="flex items-start gap-3 mb-3">
              <Skeleton variant="rectangular" width="48px" height="48px" className="rounded-xl" />
              <div className="flex-1">
                <Skeleton width="70%" height="20px" className="mb-2" />
                <Skeleton width="40%" height="16px" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        
        {/* ---------- Header ---------- */}
        <Link to="/admin/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Manage Classes</h1>
            <p className="text-gray-600 mt-2 text-base font-medium">
              {classes.length} {classes.length === 1 ? 'class' : 'classes'}
              <span className="mx-2 text-gray-300">•</span>
              {totalStudents} total students
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isReorderMode ? (
              <>
                <Button variant="secondary" size="sm" onClick={exitReorderMode} icon={X}>Cancel</Button>
                <Button size="sm" onClick={saveOrder} loading={savingOrder} icon={Save}>Save Order</Button>
              </>
            ) : (
              <>
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search for a student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {fetchingStudents && (
                    <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
                <Button variant="secondary" size="sm" icon={ListOrdered} onClick={enterReorderMode} disabled={classes.length < 2}>Reorder</Button>
                <Link to="/admin/create-class">
                  <Button size="sm" icon={FolderPlus}>Create Class</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ---------- Low attendance ---------- */}
        {!isReorderMode && (
          <div className="mb-6 bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGlobalAtt(!showGlobalLowAtt)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base">Students Below 75% Attendance</h2>
                  <p className="text-sm text-gray-600 font-medium truncate">
                    {hasFetchedGlobal ? 'Across all classes' : 'Click to scan all classes'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {hasFetchedGlobal && !loadingGlobal && (
                  <span className={`px-3 py-1 text-sm font-bold rounded-full text-white shadow-sm ${
                    globalLowAtt.length > 0 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}>
                    {globalLowAtt.length}
                  </span>
                )}
                {showGlobalLowAtt ? <ChevronUp className="w-6 h-6 text-gray-400" /> : <ChevronDown className="w-6 h-6 text-gray-400" />}
              </div>
            </button>

            {showGlobalLowAtt && (
              <div className="border-t-2 border-gray-100">
                {loadingGlobal ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
                    <span className="text-sm font-medium">Scanning all classes...</span>
                  </div>
                ) : globalLowAtt.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UserCheck className="w-8 h-8 text-emerald-600" />
                    </div>
                    <p className="text-emerald-700 font-bold text-base mb-1">All Clear!</p>
                    <p className="text-gray-600 text-sm mb-4">No students are below 75% attendance</p>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => fetchGlobalLowAttendance(true)} className="text-sm text-gray-600 hover:text-gray-900 underline font-medium">Re-check</button>
                      <button onClick={handleRebuildStats} disabled={rebuilding} className="text-sm text-gray-600 hover:text-gray-900 underline font-medium disabled:opacity-50">
                        {rebuilding ? 'Rebuilding...' : 'Rebuild totals'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                                        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-gray-50 border-b-2 border-gray-100">
                      <p className="text-sm text-gray-700 font-medium">
                        <span className="font-bold text-red-600">{globalLowAtt.length}</span> student{globalLowAtt.length > 1 ? 's' : ''} need attention
                      </p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => fetchGlobalLowAttendance(true)} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 font-medium">
                          <RefreshCw className="w-3.5 h-3.5" /> Re-check
                        </button>
                        {/* ✅ NEW: Rebuild totals button is now ALWAYS visible! */}
                        <button onClick={handleRebuildStats} disabled={rebuilding} className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 font-medium disabled:opacity-50">
                          {rebuilding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {rebuilding ? 'Rebuilding...' : 'Rebuild Totals'}
                        </button>
                        <Button size="sm" variant="secondary" icon={Download} onClick={handleExportGlobal}>Export</Button>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y-2 divide-gray-100">
                      {globalLowAtt.map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                          <span className="text-sm text-gray-400 font-semibold w-6 shrink-0">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-xs text-gray-600 truncate font-medium">
                              {s.studentId} <span className="text-gray-300 mx-1">•</span> {s.className}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-base font-bold ${s.stats.percentage < 50 ? 'text-red-600' : 'text-orange-500'}`}>{s.stats.percentage}%</span>
                            <p className="text-xs text-gray-500 font-medium">{s.stats.present}/{s.stats.total}</p>
                          </div>
                          <Link to={`/student/details/${s.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0 transition-colors">
                            <Eye className="w-5 h-5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {isReorderMode && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
            <GripVertical className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">Drag classes to reorder them. The new order will be reflected throughout the application.</p>
          </div>
        )}

        {/* ---------- Grid List with 5 columns ---------- */}
        {loading ? (
          <ClassGridSkeleton />
        ) : classes.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 text-center py-16 px-4">
            <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Layers className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Classes Yet</h3>
            <p className="text-gray-600 mb-6 text-sm">Create your first class to start managing students and attendance</p>
            <Link to="/admin/create-class">
              <Button icon={FolderPlus}>Create Your First Class</Button>
            </Link>
          </div>
        ) : displayList.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 text-center py-16 px-4">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold text-lg mb-2">No Matches Found</h3>
            <p className="text-gray-600 text-sm">Try searching with a different student name or ID</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayList.map(c => c.id)} strategy={rectSortingStrategy}>
              {/* ✅ 5 COLUMN GRID WITH 5 COLORS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {displayList.map((cls, index) => (
                  <SortableClassCard
                    key={cls.id}
                    cls={cls}
                    index={index}
                    isReorderMode={isReorderMode}
                    handleDelete={handleDelete}
                    deleting={deleting}
                    matchingStudents={isReorderMode ? null : getMatchingStudents(cls.id)}
                    lowCount={lowCountByClass[cls.id] || 0}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default ManageClasses;
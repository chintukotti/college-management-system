// src/pages/admin/ManageClasses.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Trash2, Users, Calendar, Search, Layers, Eye, Edit2, AlertTriangle, Download, ChevronDown, ChevronUp, UserCheck, Save, X, ListOrdered, GripVertical, MoreVertical, RefreshCw, GraduationCap, TrendingDown } from 'lucide-react';
import { getAllClasses, deleteClass, getStudentsByClass, updateClassesOrder, getGlobalLowAttendance, recomputeAllClassesStats } from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { createGlobalLowAttendanceExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Button from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import toast from 'react-hot-toast';

// DnD Kit Imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Rotating accents so a long list of classes stays scannable
const ACCENTS = [
  { bar: 'bg-orange-500', tile: 'bg-orange-50 text-orange-600', ring: 'group-hover:border-orange-300' },
  { bar: 'bg-blue-500', tile: 'bg-blue-50 text-blue-600', ring: 'group-hover:border-blue-300' },
  { bar: 'bg-emerald-500', tile: 'bg-emerald-50 text-emerald-600', ring: 'group-hover:border-emerald-300' },
  { bar: 'bg-violet-500', tile: 'bg-violet-50 text-violet-600', ring: 'group-hover:border-violet-300' },
  { bar: 'bg-rose-500', tile: 'bg-rose-50 text-rose-600', ring: 'group-hover:border-rose-300' },
  { bar: 'bg-cyan-500', tile: 'bg-cyan-50 text-cyan-600', ring: 'group-hover:border-cyan-300' },
];

// --- Sortable Class Card ---
const SortableClassCard = ({ cls, index, isReorderMode, handleDelete, deleting, matchingStudents, lowCount }) => {
  const [showActions, setShowActions] = useState(false);
  const accent = ACCENTS[index % ACCENTS.length];

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cls.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const actions = [
    { to: `/admin/class/${cls.id}/students`, label: 'Students', icon: Eye },
    { to: `/admin/class/${cls.id}/attendance-report`, label: 'Report', icon: Calendar },
    { to: `/admin/class/${cls.id}/crs`, label: 'CRs', icon: UserCheck },
    { to: `/admin/class/${cls.id}/edit`, label: 'Edit', icon: Edit2 },
  ];

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden
          transition-all hover:shadow-md ${accent.ring}
          ${isDragging ? 'shadow-lg border-blue-400' : ''}`}
      >
        {/* Accent spine */}
        <div className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} />

        <div className="p-3.5 sm:p-4 pl-4 sm:pl-5">
          <div className="flex items-start gap-3">
            {isReorderMode && (
              <button
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${cls.name}`}
                className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg touch-none shrink-0"
              >
                <GripVertical className="w-5 h-5" />
              </button>
            )}

            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${accent.tile}`}>
              <Layers className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-[15px] sm:text-base leading-tight break-words">
                  {cls.name}
                </h3>

                {!isReorderMode && (
                  <button
                    onClick={() => setShowActions(!showActions)}
                    aria-label="More actions"
                    className="lg:hidden p-1.5 -mr-1 -mt-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                  <Users className="w-3 h-3" />
                  {cls.studentCount || 0} students
                </span>

                {lowCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-xs font-medium">
                    <TrendingDown className="w-3 h-3" />
                    {lowCount} below 75%
                  </span>
                )}

                {cls.description && (
                  <span className="text-xs text-gray-400 truncate max-w-full sm:max-w-[16rem]">
                    {cls.description}
                  </span>
                )}
              </div>

              {/* Search hits */}
              {matchingStudents && matchingStudents.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {matchingStudents.slice(0, 3).map((student) => (
                    <span key={student.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                      <GraduationCap className="w-3 h-3" />
                      {student.studentId} • {student.name}
                    </span>
                  ))}
                  {matchingStudents.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      +{matchingStudents.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Desktop actions */}
            {!isReorderMode && (
              <div className="hidden lg:flex items-center gap-1 shrink-0">
                {actions.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    title={label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
                <button
                  onClick={() => handleDelete(cls.id, cls.name)}
                  disabled={deleting === cls.id}
                  title="Delete class"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting === cls.id
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Mobile / tablet actions */}
          {!isReorderMode && showActions && (
            <div className="lg:hidden mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-1">
              {actions.map(({ to, label, icon: Icon }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-gray-600"
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="text-[11px] font-medium">{label}</span>
                </Link>
              ))}
              <button
                onClick={() => handleDelete(cls.id, cls.name)}
                disabled={deleting === cls.id}
                className="col-span-4 mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
              >
                {deleting === cls.id
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                <span className="text-xs font-medium">Delete class</span>
              </button>
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

  // One read per class instead of one query per student
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
    if (!window.confirm(
      'Rebuild attendance totals for every class?\n\n' +
      'This reads all existing attendance records once, and is only needed for ' +
      'attendance taken before totals were tracked automatically.'
    )) return;

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

  // Low-attendance counts per class, for the badge on each card
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

  const ClassListSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 animate-pulse">
            <Skeleton variant="rectangular" width="44px" height="44px" className="rounded-xl" />
            <div className="flex-1">
              <Skeleton width="45%" height="16px" className="mb-2" />
              <Skeleton width="30%" height="12px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">

        {/* ---------- Header ---------- */}
        <Link to="/admin/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Classes</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {classes.length} {classes.length === 1 ? 'class' : 'classes'}
              <span className="mx-1.5 text-gray-300">•</span>
              {totalStudents} students
            </p>
          </div>

          <div className="flex gap-2">
            {isReorderMode ? (
              <>
                <Button variant="secondary" size="sm" onClick={exitReorderMode} icon={X} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button size="sm" onClick={saveOrder} loading={savingOrder} icon={Save} className="flex-1 sm:flex-none">
                  Save Order
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ListOrdered}
                  onClick={enterReorderMode}
                  disabled={classes.length < 2}
                  className="flex-1 sm:flex-none"
                >
                  Reorder
                </Button>
                <Link to="/admin/create-class" className="flex-1 sm:flex-none">
                  <Button size="sm" icon={FolderPlus} fullWidth>Create Class</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ---------- Low attendance ---------- */}
        {!isReorderMode && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGlobalAtt(!showGlobalLowAtt)}
              className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-[18px] h-[18px] text-red-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 text-sm">Students below 75%</h2>
                  <p className="text-xs text-gray-500 truncate">
                    {hasFetchedGlobal ? 'Across all classes' : 'Tap to check all classes'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasFetchedGlobal && !loadingGlobal && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full text-white ${
                    globalLowAtt.length > 0 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}>
                    {globalLowAtt.length}
                  </span>
                )}
                {showGlobalLowAtt
                  ? <ChevronUp className="w-5 h-5 text-gray-400" />
                  : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            {showGlobalLowAtt && (
              <div className="border-t border-gray-100">
                {loadingGlobal ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                    <span className="text-sm">Checking classes...</span>
                  </div>
                ) : globalLowAtt.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-emerald-700 font-medium text-sm">No student is below 75%</p>
                    <div className="flex items-center justify-center gap-4 mt-3">
                      <button onClick={() => fetchGlobalLowAttendance(true)} className="text-xs text-gray-500 hover:text-gray-700 underline">
                        Re-check
                      </button>
                      <button onClick={handleRebuildStats} disabled={rebuilding} className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50">
                        {rebuilding ? 'Rebuilding...' : 'Rebuild totals'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold text-red-600">{globalLowAtt.length}</span> student{globalLowAtt.length > 1 ? 's' : ''} need attention
                      </p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => fetchGlobalLowAttendance(true)} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Re-check
                        </button>
                        <Button size="sm" variant="secondary" icon={Download} onClick={handleExportGlobal}>
                          Export
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {globalLowAtt.map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-3 px-3.5 sm:px-4 py-2.5 hover:bg-gray-50">
                          <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {s.studentId} <span className="text-gray-300">•</span> {s.className}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-sm font-bold ${s.stats.percentage < 50 ? 'text-red-600' : 'text-orange-500'}`}>
                              {s.stats.percentage}%
                            </span>
                            <p className="text-[11px] text-gray-400">{s.stats.present}/{s.stats.total}</p>
                          </div>
                          <Link to={`/student/details/${s.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0">
                            <Eye className="w-4 h-4" />
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

        {/* ---------- Search ---------- */}
        {!isReorderMode && (
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px] pointer-events-none" />
            <input
              type="text"
              placeholder="Find a student by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {fetchingStudents && (
              <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
            )}
            {!fetchingStudents && searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {isReorderMode && (
          <div className="mb-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <GripVertical className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Drag classes into the order you want. It applies everywhere in the app.
            </p>
          </div>
        )}

        {/* ---------- List ---------- */}
        {loading ? (
          <ClassListSkeleton />
        ) : classes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-14 px-4">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Layers className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No classes yet</h3>
            <p className="text-gray-500 mb-6 text-sm">Create your first class to start adding students</p>
            <Link to="/admin/create-class">
              <Button icon={FolderPlus}>Create Class</Button>
            </Link>
          </div>
        ) : displayList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-14 px-4">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-900 font-medium mb-1">No students matched</h3>
            <p className="text-gray-500 text-sm">Try a different name or ID</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayList.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2.5">
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

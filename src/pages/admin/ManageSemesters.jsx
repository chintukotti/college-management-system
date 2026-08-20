// src/pages/admin/ManageSemesters.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, Plus, Trash2, Calendar, Edit2 } from 'lucide-react';
import { getAllSemesters, deleteSemester, updateSemester } from '../../firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ManageSemesters = () => {
  const { currentUser } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  
  // Edit State
  const [editingSem, setEditingSem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { fetchSemesters(); }, []);

  const fetchSemesters = async () => {
    const result = await getAllSemesters(currentUser.uid);
    if (result.success) setSemesters(result.data);
    else toast.error("Failed to load semesters");
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This deletes all related subjects.`)) return;
    setDeletingId(id);
    const result = await deleteSemester(id);
    if (result.success) {
      toast.success('Deleted');
      setSemesters(prev => prev.filter(s => s.id !== id));
    } else toast.error(result.error);
    setDeletingId(null);
  };

  const openEditModal = (sem) => {
    setEditingSem(sem);
    setEditForm({ 
      name: sem.name, 
      startDate: sem.startDate, 
      endDate: sem.endDate,
      isActive: sem.isActive || false
    });
  };

  const handleUpdate = async () => {
    if(!editForm.name || !editForm.startDate || !editForm.endDate) {
        toast.error("Fill all fields");
        return;
    }
    setSavingEdit(true);
    const result = await updateSemester(editingSem.id, editForm);
    if(result.success) {
        toast.success("Semester Updated");
        setSemesters(prev => prev.map(s => s.id === editingSem.id ? {...s, ...editForm} : s));
        setEditingSem(null);
    } else {
        toast.error(result.error);
    }
    setSavingEdit(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Link to="/admin/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Link>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Semesters</h1>
          <Link to="/admin/create-semester" className="self-start sm:self-auto">
            <Button icon={Plus}>Create Semester</Button>
          </Link>
        </div>

        {/* ── Semester List ── */}
        <div className="grid gap-4">
          {semesters.length === 0 ? (
            <Card className="text-center py-12">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No semesters created yet.</p>
            </Card>
          ) : (
            semesters.map((sem) => (
              <Card key={sem.id} className="hover:shadow-md transition-shadow">
                {/* Stack vertically on mobile, row on md+ */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* ── Info ── */}
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg shrink-0">
                      <Calendar className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {sem.name}
                        {sem.isActive && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {sem.startDate} to {sem.endDate}
                      </p>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="flex flex-wrap gap-2 ml-0 md:ml-auto">
                    <Link to={`/admin/semester/${sem.id}`}>
                      <Button variant="secondary" size="sm">Manage Subjects</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onClick={() => openEditModal(sem)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(sem.id, sem.name)}
                      loading={deletingId === sem.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* ── Edit Modal ── */}
      {editingSem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-auto max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Semester</h2>
            <div className="space-y-4">
              <Input
                label="Name"
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="Start Date"
                type="date"
                value={editForm.startDate}
                onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                value={editForm.endDate}
                onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={editForm.isActive}
                  onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                <label htmlFor="isActiveEdit">Set as Active Semester</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="secondary" onClick={() => setEditingSem(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleUpdate} loading={savingEdit} className="flex-1">
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ManageSemesters;
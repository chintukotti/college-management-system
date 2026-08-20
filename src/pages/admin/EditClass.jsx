// src/pages/admin/EditClass.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Layers, Save, UserPlus, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassById, updateClassWithStudents, registerStudentWithId } from '../../firebase/services';
import { readExcelFile, validateStudentExcelData, downloadSampleExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const EditClass = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [classData, setClassData] = useState(null);
  const [originalClassName, setOriginalClassName] = useState('');  // ✅ ADD THIS
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // For adding new students
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [, setExcelFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);

  useEffect(() => {
    fetchClass();
  }, [classId]);

  const fetchClass = async () => {
    const result = await getClassById(classId);
    if (result.success) {
      setClassData(result.data);
      setOriginalClassName(result.data.name || '');  // ✅ STORE ORIGINAL NAME
      setFormData({
        name: result.data.name || '',
        description: result.data.description || ''
      });
    } else {
      toast.error('Class not found');
      navigate('/admin/classes');
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // ✅ UPDATED: Now uses updateClassWithStudents
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const nameChanged = formData.name !== originalClassName;

    // Use the new function that updates both class and students
    const result = await updateClassWithStudents(
      classId, 
      {
        name: formData.name,
        description: formData.description
      },
      nameChanged ? originalClassName : null  // Pass old name only if changed
    );

    if (result.success) {
      if (nameChanged) {
        toast.success('Class and all students updated successfully');
        setOriginalClassName(formData.name);  // Update the stored original name
      } else {
        toast.success('Class updated successfully');
      }
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const handleFileSelect = async (file) => {
    setExcelFile(file);
    setValidationResult(null);

    if (!file) return;

    setProcessing(true);
    try {
      const data = await readExcelFile(file);
      const validation = validateStudentExcelData(data);
      setValidationResult(validation);

      if (!validation.valid) {
        toast.error('Excel file has validation errors');
      } else {
        toast.success(`Found ${validation.data.length} valid students`);
      }
    } catch (error) {
      toast.error(error.message);
      setExcelFile(null);
    }
    setProcessing(false);
  };

  const handleAddStudents = async () => {
    if (!validationResult?.valid || !validationResult?.data?.length) {
      toast.error('Please upload a valid Excel file');
      return;
    }

    setAddingStudents(true);

    let successCount = 0;
    let errorCount = 0;

    for (const student of validationResult.data) {
      const result = await registerStudentWithId(
        student.id,
        student.password,
        student.name,
        student.gender,
        classId,
        formData.name,  // Uses current form name (in case user changed it)
        currentUser.uid
      );

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Failed to add ${student.id}:`, result.error);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} students added successfully`);
      
      // registerStudentWithId already increments studentCount on the class
      // document, so writing it again here would just overwrite the correct
      // value with one derived from possibly-stale local state.
      setClassData(prev => ({
        ...prev,
        studentCount: (prev.studentCount || 0) + successCount
      }));
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} students failed to add`);
    }

    setExcelFile(null);
    setValidationResult(null);
    setShowAddStudents(false);
    setAddingStudents(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/admin/classes"
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Classes
        </Link>

        {/* Edit Class Details */}
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Layers className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Edit Class</h1>
              <p className="text-gray-600">Update class details</p>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <Input
              label="Class Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., CSE-A 2024"
              icon={Layers}
              required
            />

            {/* ✅ NEW: Show info if name is being changed */}
            {formData.name !== originalClassName && formData.name && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm">
                  ℹ️ Changing class name will also update the className for all students in this class.
                </p>
              </div>
            )}

            <Input
              label="Description (Optional)"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description"
            />

            <Button
              type="submit"
              loading={saving}
              icon={Save}
            >
              {formData.name !== originalClassName 
                ? 'Save Changes & Update Students' 
                : 'Save Changes'
              }
            </Button>
          </form>
        </Card>

        {/* Add More Students Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Add More Students</h2>
                <p className="text-gray-600 text-sm">
                  Upload Excel to add new students to this class
                  {classData?.studentCount > 0 && (
                    <span className="ml-1">
                      (Current: {classData.studentCount} students)
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            {!showAddStudents && (
              <Button
                variant="success"
                icon={UserPlus}
                onClick={() => setShowAddStudents(true)}
              >
                Add Students
              </Button>
            )}
          </div>

          {showAddStudents && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-end mb-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={downloadSampleExcel}
                >
                  Download Template
                </Button>
              </div>

              <FileUpload
                onFileSelect={handleFileSelect}
                label="Upload Student Excel File"
                description="Excel must have columns: ID, Password, Name, Gender"
              />

              {processing && (
                <div className="mt-4">
                  <Loading message="Processing Excel file..." />
                </div>
              )}

              {validationResult && (
                <div className="mt-4">
                  {validationResult.valid ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 font-medium">
                        ✓ {validationResult.data.length} students ready to be added
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 font-medium mb-2">Validation Errors:</p>
                      <ul className="text-red-600 text-sm list-disc list-inside">
                        {validationResult.errors.slice(0, 5).map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAddStudents(false);
                    setExcelFile(null);
                    setValidationResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={handleAddStudents}
                  loading={addingStudents}
                  disabled={!validationResult?.valid}
                  icon={UserPlus}
                >
                  Add {validationResult?.data?.length || 0} Students
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Link to view/edit students */}
        <div className="mt-6">
          <Link to={`/admin/class/${classId}/students`}>
            <Button variant="secondary" fullWidth>
              View & Edit Students in this Class
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default EditClass;
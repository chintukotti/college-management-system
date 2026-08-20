// src/pages/admin/CreateClass.jsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Layers,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createClassWithStudents } from '../../firebase/services';
import { readExcelFile, validateStudentExcelData, downloadSampleExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const CreateClass = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [, setExcelFile] = useState(null);
  const [, setParsedData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileSelect = async (file) => {
    setExcelFile(file);
    setParsedData(null);
    setValidationResult(null);

    if (!file) return;

    setProcessing(true);
    try {
      const data = await readExcelFile(file);
      const validation = validateStudentExcelData(data);
      
      setParsedData(data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validationResult?.valid || !validationResult?.data?.length) {
      toast.error('Please upload a valid Excel file with student data');
      return;
    }

    setLoading(true);

    const result = await createClassWithStudents(
      formData.name,
      formData.description,
      validationResult.data,
      currentUser.uid
    );

      if (result.success) {
        toast.success(`Class created! ${result.createdCount}/${result.totalCount} students added.`);
        navigate('/admin/classes');
      } else {
        toast.error(result.error);
      }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/admin/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>

        <Card>
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
              <Layers className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              Create New Class
            </h1>
            <p className="text-gray-600 mt-2">
              Upload an Excel file to create a class with students
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Class Details */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-4">Class Details</h3>
              
              <Input
                label="Class Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., CSE-A 2024 or BCA-1st Year"
                icon={Layers}
                required
              />

              <Input
                label="Description (Optional)"
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the class"
              />
            </div>

            {/* Excel Upload Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Student Data</h3>
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
                <div className="mt-4 text-center">
                  <Loading message="Processing Excel file..." />
                </div>
              )}

              {/* Validation Results */}
              {validationResult && (
                <div className="mt-4">
                  {validationResult.valid ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Validation Passed!</span>
                      </div>
                      <p className="text-green-600 text-sm">
                        {validationResult.data.length} students ready to be created
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">
                          Validation Failed — {validationResult.errors.length} issue(s) found
                        </span>
                      </div>
                      <ul className="text-red-600 text-sm list-disc list-inside max-h-40 overflow-y-auto">
                        {validationResult.errors.map((error, idx) => (
                          <li key={idx} className="break-all">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {validationResult?.valid && validationResult?.data?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">Preview (First 5 students)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">ID</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Gender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.data.slice(0, 5).map((student, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2">{student.id}</td>
                            <td className="px-4 py-2">{student.name}</td>
                            <td className="px-4 py-2">{student.gender}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validationResult.data.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ...and {validationResult.data.length - 5} more students
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Excel Format Info */}
            <Card className="mb-6 bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h4 className="font-medium text-blue-800">Excel File Format</h4>
                  <p className="text-sm text-blue-600 mt-1">
                    Your Excel file must have these columns in the first row:
                  </p>
                  <ul className="text-sm text-blue-600 mt-2 list-disc list-inside">
                    <li><strong>ID</strong> - Student ID (will be used as login username)</li>
                    <li><strong>Password</strong> - Password (minimum 6 characters)</li>
                    <li><strong>Name</strong> - Full name of the student</li>
                    <li><strong>Gender</strong> - Male/Female/Other (optional)</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin/dashboard')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={!validationResult?.valid}
                fullWidth
                icon={Users}
              >
                Create Class with {validationResult?.data?.length || 0} Students
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default CreateClass;
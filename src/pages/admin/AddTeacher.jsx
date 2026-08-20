import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  User,
  UserPlus,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Upload
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { registerUser, registerTeachersFromExcel } from '../../firebase/services';
import { readExcelFile, downloadTeacherSampleExcel } from '../../utils/excelUtils';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import toast from 'react-hot-toast';

const AddTeacher = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [mode, setMode] = useState('manual'); // 'manual' or 'excel'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  
  // Excel state
  const [, setExcelFile] = useState(null);
  const [, setParsedData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await registerUser(
      formData.email,
      formData.password,
      formData.name,
      'teacher',
      currentUser.uid
    );
    
    if (result.success) {
      toast.success('Teacher added successfully!');
      navigate('/admin/teachers');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleFileSelect = async (file) => {
    setExcelFile(file);
    setParsedData(null);
    setValidationResult(null);

    if (!file) return;

    setProcessing(true);
    try {
      const data = await readExcelFile(file);
      
      // Validate columns
      const requiredColumns = ['Name', 'Password', 'Email'];
      if (data.length === 0) {
        setValidationResult({ valid: false, errors: ['Excel file is empty'] });
      } else {
        const firstRow = data[0];
        const headers = Object.keys(firstRow);
        const missingCols = requiredColumns.filter(col => 
          !headers.some(h => h.toLowerCase() === col.toLowerCase())
        );

        if (missingCols.length > 0) {
          setValidationResult({ 
            valid: false, 
            errors: [`Missing columns: ${missingCols.join(', ')}. Required: Name, Email, Password`] 
          });
        } else {
          // Normalize and validate each row
          const validData = [];
          const rowErrors = [];

          data.forEach((row, index) => {
            const rowNum = index + 2;
            const name = (row.Name || '').trim();
            const email = (row.Email || '').trim();
            const password = (row.Password || '').trim();

            if (!name) { rowErrors.push(`Row ${rowNum}: Missing Name`); return; }
            if (!email || !email.includes('@')) { rowErrors.push(`Row ${rowNum}: Invalid Email`); return; }
            if (password.length < 6) { rowErrors.push(`Row ${rowNum}: Password less than 6 characters`); return; }

            validData.push({ name, email, password });
          });

          if (rowErrors.length === 0) {
            setParsedData(validData);
            setValidationResult({ valid: true, data: validData, errors: [] });
            toast.success(`${validData.length} valid teachers found`);
          } else {
            setValidationResult({ valid: false, errors: rowErrors });
          }
        }
      }
    } catch (error) {
      toast.error(error.message);
      setExcelFile(null);
    }
    setProcessing(false);
  };

  const handleExcelSubmit = async (e) => {
    e.preventDefault();
    if (!validationResult?.valid || !validationResult?.data?.length) {
      toast.error('Please upload a valid Excel file');
      return;
    }

    setLoading(true);
    const result = await registerTeachersFromExcel(validationResult.data, currentUser.uid);

    if (result.success) {
      let msg = `${result.created.length}/${result.totalCount} teachers created successfully!`;
      if (result.duplicateCount > 0) {
        msg += ` (${result.duplicateCount} skipped)`;
      }
      toast.success(msg);
      navigate('/admin/teachers');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/admin/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>

        <Card>
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-blue-100 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              Add New Teacher
            </h1>
            <p className="text-gray-600 mt-2">
              Create teacher accounts manually or via Excel
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex border-b mb-6">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                mode === 'manual'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Manual Entry
            </button>
            <button
              onClick={() => setMode('excel')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                mode === 'excel'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Excel Upload
            </button>
          </div>

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit}>
              <Input
                label="Full Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                icon={User}
                required
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="teacher@college.com"
                icon={Mail}
                required
              />

              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                icon={Lock}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                icon={Lock}
                required
              />

              <div className="flex gap-4 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/admin/teachers')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  fullWidth
                >
                  Add Teacher
                </Button>
              </div>
            </form>
          )}

          {/* EXCEL MODE */}
          {mode === 'excel' && (
            <form onSubmit={handleExcelSubmit}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Upload Excel File</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={downloadTeacherSampleExcel}
                >
                  Download Template
                </Button>
              </div>

              <FileUpload
                onFileSelect={handleFileSelect}
                label="Teacher Excel File"
                description="Drag and drop or click to upload"
              />

              {processing && (
                <div className="mt-4 text-center text-gray-400 text-sm">
                  Processing file...
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
                        {validationResult.data.length} teachers ready to be created
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Validation Errors</span>
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
                  <h4 className="font-medium text-gray-700 mb-2">Preview (First 5)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Password</th>
                          <th className="px-4 py-2 text-left">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.data.slice(0, 5).map((teacher, idx) => (
                          <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{teacher.name}</td>
                          <td className="px-4 py-2 text-gray-400">••••••</td>
                          <td className="px-4 py-2">{teacher.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validationResult.data.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ...and {validationResult.data.length - 5} more teachers
                    </p>
                  )}
                </div>
              )}

              {/* Excel Format Info */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Excel Format</h4>
                    <p className="text-sm text-blue-600 mt-1">
                      First row must contain these column headers:
                    </p>
                    <ul className="text-sm text-blue-600 mt-2 list-disc list-inside">
                      <li><strong>Name</strong> — Full name of teacher</li>
                      <li><strong>Password</strong> — Minimum 6 characters</li>
                      <li><strong>Email</strong> — Valid email address</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/admin/teachers')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!validationResult?.valid}
                  fullWidth
                  icon={UserPlus}
                >
                  Create {validationResult?.data?.length || 0} Teachers
                </Button>
              </div>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AddTeacher;
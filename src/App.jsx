import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/common/Loading';

// AUTH PAGES
const Contact = lazy(() => import('./pages/auth/Contact'));
const Login = lazy(() => import('./pages/auth/Login'));
const RoleSelection = lazy(() => import('./pages/auth/RoleSelection'));

// ADMIN PAGES
const AddTeacher = lazy(() => import('./pages/admin/AddTeacher'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSemesterDetails = lazy(() => import('./pages/admin/AdminSemesterDetails'));
const ClassAttendanceReport = lazy(() => import('./pages/admin/ClassAttendanceReport'));
const ClassStudents = lazy(() => import('./pages/admin/ClassStudents'));
const CreateClass = lazy(() => import('./pages/admin/CreateClass'));
const CreateSemester = lazy(() => import('./pages/admin/CreateSemester'));
const EditClass = lazy(() => import('./pages/admin/EditClass'));
const ManageClasses = lazy(() => import('./pages/admin/ManageClasses'));
const ManageCRs = lazy(() => import('./pages/admin/ManageCRs'));
const ManageSemesters = lazy(() => import('./pages/admin/ManageSemesters'));
const ManageTeachers = lazy(() => import('./pages/admin/ManageTeachers'));
const ViewMessages = lazy(() => import('./pages/admin/ViewMessages'));
const ViewTeacherActivity = lazy(() => import('./pages/admin/ViewTeacherActivity'));

// TEACHER PAGES
const EditAttendance = lazy(() => import('./pages/teacher/EditAttendance'));
const SemesterDetails = lazy(() => import('./pages/teacher/SemesterDetails'));
const SubjectDetails = lazy(() => import('./pages/teacher/SubjectDetails'));
const TakeAttendance = lazy(() => import('./pages/teacher/TakeAttendance'));
const TeacherActivity = lazy(() => import('./pages/teacher/TeacherActivity'));
const TeacherAnnouncements = lazy(() => import('./pages/teacher/TeacherAnnouncements'));
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const ViewAttendanceSheet = lazy(() => import('./pages/teacher/ViewAttendanceSheet'));
const TeacherChangePassword = lazy(() => import('./pages/teacher/ChangePassword')); // ✅ Ensure this line is exactly like this

// STUDENT PAGES
const ChangePassword = lazy(() => import('./pages/student/ChangePassword'));
const StudentAnnouncements = lazy(() => import('./pages/student/StudentAnnouncements'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const TakeClassAttendance = lazy(() => import('./pages/student/TakeClassAttendance'));
const ViewAttendance = lazy(() => import('./pages/student/ViewAttendance'));

// SHARED PAGES
const StudentDetails = lazy(() => import('./pages/shared/StudentDetails'));

const guarded = (roles, Component) => (
  <ProtectedRoute allowedRoles={roles}><Component /></ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#333', color: '#fff' },
            success: { style: { background: '#22c55e' } },
            error: { style: { background: '#ef4444' } },
          }}
        />

        <Suspense fallback={<Loading message="Loading" />}>
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/" element={<RoleSelection />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/contact" element={<Contact />} />

            {/* ADMIN ROUTES */}
            <Route path="/admin/dashboard" element={guarded(['admin'], AdminDashboard)} />
            <Route path="/admin/add-teacher" element={guarded(['admin'], AddTeacher)} />
            <Route path="/admin/teachers" element={guarded(['admin'], ManageTeachers)} />
            <Route path="/admin/teacher/:teacherId/activity" element={guarded(['admin'], ViewTeacherActivity)} />
            <Route path="/admin/create-class" element={guarded(['admin'], CreateClass)} />
            <Route path="/admin/classes" element={guarded(['admin'], ManageClasses)} />
            <Route path="/admin/class/:classId/students" element={guarded(['admin'], ClassStudents)} />
            <Route path="/admin/class/:classId/edit" element={guarded(['admin'], EditClass)} />
            <Route path="/admin/class/:classId/crs" element={guarded(['admin'], ManageCRs)} />
            <Route path="/admin/class/:classId/attendance-report" element={guarded(['admin'], ClassAttendanceReport)} />
            <Route path="/admin/create-semester" element={guarded(['admin'], CreateSemester)} />
            <Route path="/admin/semesters" element={guarded(['admin'], ManageSemesters)} />
            <Route path="/admin/semester/:semesterId" element={guarded(['admin'], AdminSemesterDetails)} />
            <Route path="/admin/messages" element={guarded(['admin'], ViewMessages)} />

            {/* TEACHER ROUTES */}
            <Route path="/teacher/dashboard" element={guarded(['teacher'], TeacherDashboard)} />
            <Route path="/teacher/announcements" element={guarded(['teacher'], TeacherAnnouncements)} />
            <Route path="/teacher/semester/:semesterId" element={guarded(['teacher'], SemesterDetails)} />
            <Route path="/teacher/subject/:subjectId" element={guarded(['teacher'], SubjectDetails)} />
            <Route path="/teacher/subject/:subjectId/activity" element={guarded(['teacher'], TeacherActivity)} />
            <Route path="/teacher/class/:classId/students" element={guarded(['teacher'], ClassStudents)} />
            <Route path="/teacher/subject/:subjectId/class/:classId/attendance" element={guarded(['teacher'], TakeAttendance)} />
            <Route path="/teacher/subject/:subjectId/class/:classId/sheet" element={guarded(['teacher'], ViewAttendanceSheet)} />
            <Route path="/teacher/subject/:subjectId/edit-attendance" element={guarded(['teacher'], EditAttendance)} />
            <Route path="/teacher/class/:classId/cr-attendance-report" element={guarded(['teacher'], ClassAttendanceReport)} />
            {/* ✅ Ensure this route is exactly like this */}
            <Route path="/teacher/change-password" element={guarded(['teacher'], TeacherChangePassword)} />

            {/* STUDENT ROUTES */}
            <Route path="/student/dashboard" element={guarded(['student'], StudentDashboard)} />
            <Route path="/student/change-password" element={guarded(['student'], ChangePassword)} />
            <Route path="/student/attendance" element={guarded(['student'], ViewAttendance)} />
            <Route path="/student/take-attendance" element={guarded(['student'], TakeClassAttendance)} />
            <Route path="/student/class-report/:classId" element={guarded(['student'], ClassAttendanceReport)} />
            <Route path="/student/announcements" element={guarded(['student'], StudentAnnouncements)} />

            {/* SHARED ROUTES */}
            <Route path="/student/details/:studentId" element={guarded(['admin', 'teacher'], StudentDetails)} />

            {/* FALLBACK ROUTE */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
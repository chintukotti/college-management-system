import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subject caching used to live here but nothing consumed it — caching now
  // sits in the service layer (src/utils/cache.js), so every caller benefits
  // rather than only components with access to this context.

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.isAnonymous) {
          // A corrupt studentSession must not take the whole app down. This
          // callback is async, so a throw here would skip setLoading(false)
          // and the provider renders nothing at all — a permanent white screen
          // that only clearing localStorage by hand recovers from.
          let studentData = null;
          try {
            const storedStudent = localStorage.getItem('studentSession');
            if (storedStudent) studentData = JSON.parse(storedStudent);
          } catch {
            localStorage.removeItem('studentSession');
          }

          setCurrentUser(studentData || null);
          setUserRole(studentData ? 'student' : null);
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              ...userData
            });
            setUserRole(userData.role);
          } else {
            setCurrentUser(null);
            setUserRole(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUser(null);
          setUserRole(null);
        }
      } else {
        localStorage.removeItem('studentSession');
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    loading,
    isAdmin: userRole === 'admin',
    isTeacher: userRole === 'teacher',
    isStudent: userRole === 'student',
    setStudentSession: (studentData) => {
      localStorage.setItem('studentSession', JSON.stringify(studentData));
      setCurrentUser(studentData);
      setUserRole('student');
    },
    // Students stay signed in anonymously at the Firebase level, so logging one
    // out never fires onAuthStateChanged. Without this the context kept the
    // student populated and ProtectedRoute let them straight back in until the
    // page was reloaded.
    clearStudentSession: () => {
      localStorage.removeItem('studentSession');
      setCurrentUser(null);
      setUserRole(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
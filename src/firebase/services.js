// src/firebase/services.js

import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, setDoc, writeBatch, arrayUnion, arrayRemove, deleteField, documentId, limit, startAfter, increment, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';
import { auth, secondaryAuth, db } from './config';
import { TTL, keys, withCache, getCache, getCacheEntry, setCache, invalidate, invalidatePrefix, clearCache } from '../utils/cache';

// ==================== CACHE INVALIDATION HELPERS ====================

/** Drop every cached entry that could be affected by a class change. */
const invalidateClassCaches = (classId) => {
  invalidatePrefix('classes:');
  invalidatePrefix('counts:');
  if (classId) {
    invalidate(keys.classById(classId));
    invalidate(keys.studentsByClass(classId));
    invalidate(keys.subjectsForStudent(classId));
    invalidate(keys.classAttendance(classId));
  }
};

/** Drop every cached entry that could be affected by a subject change. */
const invalidateSubjectCaches = (subjectId, semesterId) => {
  invalidatePrefix('subjects:');
  invalidatePrefix('counts:');
  if (subjectId) invalidate(keys.subjectById(subjectId));
  if (semesterId) invalidate(keys.subjectsBySemester(semesterId));
};

/** Drop every cached entry that could be affected by a user change. */
const invalidateUserCaches = (classId) => {
  invalidatePrefix('users:');
  invalidatePrefix('counts:');
  if (classId) invalidate(keys.studentsByClass(classId));
};

/** Exposed so the UI can force a full refresh (logout / "Refresh" buttons). */
export const clearAllCaches = clearCache;

// ==================== AUTH SERVICES ====================

export const registerUser = async (email, password, name, role, createdBy = null) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, 'users', user.uid), {
      email,
      name,
      role,
      createdAt: serverTimestamp(),
      createdBy
    });

    invalidateUserCaches();
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const registerStudentWithId = async (studentId, password, name, gender, classId, className, createdBy) => {
  try {
    const studentRef = doc(db, 'users', studentId.toUpperCase());
    const studentSnap = await getDoc(studentRef);
    
    if (studentSnap.exists()) {
      return { success: false, error: 'Student ID already exists' };
    }

    await setDoc(studentRef, {
      uid: studentId.toUpperCase(),
      studentId: studentId.toUpperCase(),
      email: `${studentId.toLowerCase()}@rguktsklm.ac.in`,
      password: password,
      name,
      gender,
      role: 'student',
      classId,
      className,
      createdAt: serverTimestamp(),
      createdBy
    });

    if (classId) {
      // studentCount is shown on every class card and in the admin total, so it
      // has to move with the roster rather than only being set at class
      // creation and on bulk import.
      await updateDoc(doc(db, 'classes', classId), {
        studentIds: arrayUnion(studentId.toUpperCase()),
        studentCount: increment(1)
      });
    }

    invalidateUserCaches(classId);
    invalidateClassCaches(classId);
    return { success: true, oderId: studentId.toUpperCase() };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (identifier, password) => {
  try {
    let email = identifier;
    
    if (!identifier.includes('@')) {
      const studentId = identifier.toUpperCase();

      if (!auth.currentUser || !auth.currentUser.isAnonymous) {
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          await signOut(auth);
        }
        await signInAnonymously(auth);
      }

      const studentRef = doc(db, 'users', studentId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        throw new Error('Student ID not found');
      }

      const studentData = studentSnap.data();

      if (studentData.password !== password) {
        throw new Error('Invalid password');
      }

      return { success: true, user: { uid: studentId, ...studentData } };
    }

    if (auth.currentUser && auth.currentUser.isAnonymous) {
      await signOut(auth);
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }

    return { success: true, user: { uid: user.uid, ...userDoc.data() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async (role) => {
  try {
    // Never leave one account's cached data behind for the next sign-in
    clearCache();
    if (role === 'student') return { success: true };
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ... [Keep all previous code in services.js the same] ...

export const registerTeachersFromExcel = async (teachersData, createdBy) => {
  try {
    const created = [];
    const errors = [];

    // Check duplicates within upload
    const seenEmails = new Set();
    const duplicateInUpload = new Set();
    teachersData.forEach(t => {
      const emailLower = t.email.toLowerCase().trim();
      if (seenEmails.has(emailLower)) duplicateInUpload.add(emailLower);
      seenEmails.add(emailLower);
    });

    // Check duplicates against existing users
    for (let i = 0; i < teachersData.length; i += 30) {
      const chunk = teachersData.slice(i, i + 30);
      const emails = chunk.map(t => t.email.toLowerCase().trim());
      const q = query(collection(db, 'users'), where('email', 'in', emails));
      const existingSnaps = await getDocs(q);
      existingSnaps.forEach(doc => {
        errors.push(`Duplicate: "${doc.data().email}" already exists — skipped`);
      });
    }

    const existingSet = new Set(errors.map(e => {
      const match = e.match(/"([^"]+)"/);
      return match ? match[1].toLowerCase().trim() : '';
    }));

    // Create teachers one by one (secondary auth)
    for (const teacher of teachersData) {
      const email = teacher.email.toLowerCase().trim();
      const name = teacher.name?.trim();
      const password = (teacher.password || '').trim();

      // BUG FIX: Only skip if it's a duplicate in this upload or in DB
      if (duplicateInUpload.has(email)) continue;
      if (existingSet.has(email)) continue;

      // Validate
      if (!name) {
        errors.push(`Missing name for "${email}" — skipped`);
        continue;
      }
      if (!email || !email.includes('@')) {
        errors.push(`Invalid email "${email}" — skipped`);
        continue;
      }
      if (password.length < 6) {
        errors.push(`"${email}" — password less than 6 characters — skipped`);
        continue;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
          email,
          name,
          role: 'teacher',
          createdAt: serverTimestamp(),
          createdBy
        });

        created.push({ email, name, uid: user.uid });
      } catch (err) {
        const msg = err.message;
        if (msg.includes('email-already-in-use')) {
          errors.push(`"${email}" — already registered in Firebase — skipped`);
        } else {
          errors.push(`"${email}" — ${msg}`);
        }
      }
    }

    if (created.length) invalidateUserCaches();
    return {
      success: true,
      created,
      totalCount: teachersData.length,
      duplicateCount: errors.length + duplicateInUpload.size,
      errors
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ... [Keep all remaining code in services.js the same] ...

// ==================== USER MANAGEMENT ====================

export const getUsersByRole = async (role, adminId = null, force = false) => {
  return withCache(keys.usersByRole(role, adminId), TTL.LONG, async () => {
    try {
      let q;
      if (adminId) {
        q = query(collection(db, 'users'), where('role', '==', role), where('createdBy', '==', adminId));
      } else {
        q = query(collection(db, 'users'), where('role', '==', role), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);
      let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (adminId) {
        users.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt.seconds - a.createdAt.seconds;
        });
      }

      return { success: true, data: users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

/**
 * Count documents without reading them.
 * Firestore bills one read per 1000 counted documents, so counting 1500
 * students costs 2 reads instead of 1500.
 */
export const getRoleCount = async (role, adminId = null) => {
  try {
    const constraints = [where('role', '==', role)];
    if (adminId) constraints.push(where('createdBy', '==', adminId));
    const snapshot = await getCountFromServer(query(collection(db, 'users'), ...constraints));
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    return { success: false, error: error.message, count: 0 };
  }
};

/** Count documents in any collection owned by an admin. @see getRoleCount */
export const getCollectionCount = async (collectionName, adminId = null) => {
  try {
    const constraints = adminId ? [where('createdBy', '==', adminId)] : [];
    const snapshot = await getCountFromServer(query(collection(db, collectionName), ...constraints));
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    return { success: false, error: error.message, count: 0 };
  }
};

export const getStudentsByClass = async (classId, force = false) => {
  return withCache(keys.studentsByClass(classId), TTL.MEDIUM, async () => {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', classId));
    const snapshot = await getDocs(q);
    let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    students.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 99999;
      const orderB = b.order !== undefined ? b.order : 99999;
      if (orderA !== orderB) return orderA - orderB;
      
      const idA = (a.studentId || '').toUpperCase();
      const idB = (b.studentId || '').toUpperCase();
      const matchA = idA.match(/^([A-Z]+)(\d+)(.*)$/);
      const matchB = idB.match(/^([A-Z]+)(\d+)(.*)$/);
      
      if (matchA && matchB) {
        const prefixCompare = matchB[1].localeCompare(matchA[1]);
        if (prefixCompare !== 0) return prefixCompare;
        const numA = parseInt(matchA[2]) || 0;
        const numB = parseInt(matchB[2]) || 0;
        if (numA !== numB) return numA - numB;
        return (matchA[3] || '').localeCompare(matchB[3] || '');
      }
      return idB.localeCompare(idA);
    });

    return { success: true, data: students };
  } catch (error) {
    return { success: false, error: error.message };
  }
  }, force);
};

export const updateStudentsOrder = async (classId, orderedStudentIds) => {
  try {
    const batch = writeBatch(db);
    orderedStudentIds.forEach((studentId, index) => {
      batch.update(doc(db, 'users', studentId), { order: index });
    });
    await batch.commit();
    invalidate(keys.studentsByClass(classId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteUser = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const classId = userDoc.exists() ? userDoc.data().classId : null;
    if (classId) {
      await updateDoc(doc(db, 'classes', classId), {
        studentIds: arrayRemove(userId),
        studentCount: increment(-1)
      });
    }
    await deleteDoc(doc(db, 'users', userId));
    invalidateUserCaches(classId);
    invalidateClassCaches(classId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUser = async (userId, data) => {
  try {
    await updateDoc(doc(db, 'users', userId), data);
    invalidateUserCaches(data?.classId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== CLASS MANAGEMENT ====================

// export const createClassWithStudents = async (className, description, studentsData, createdBy) => {
//   try {
//     const classRef = await addDoc(collection(db, 'classes'), {
//       name: className,
//       description,
//       studentCount: studentsData.length,
//       createdBy,
//       studentIds: [], 
//       createdAt: serverTimestamp()
//     });

//     const classId = classRef.id;
//     const createdStudents = [];
//     const errors = [];
//     const batch = writeBatch(db);

//     const allIds = studentsData.map(s => s.id.toUpperCase());
//     for (let i = 0; i < allIds.length; i += 30) {
//       const chunk = allIds.slice(i, i + 30);
//       const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
//       const existingSnaps = await getDocs(q);
//       existingSnaps.forEach(doc => {
//         errors.push(`Failed to create ${doc.id}: Student ID already exists`);
//       });
//     }

//     const existingSet = new Set(errors.map(e => e.split(' ')[3]));
    
//     studentsData.forEach(student => {
//       const studentId = student.id.toUpperCase();
//       if (existingSet.has(studentId)) return;

//       const studentRef = doc(db, 'users', studentId);
//       batch.set(studentRef, {
//         uid: studentId,
//         studentId: studentId,
//         email: `${studentId.toLowerCase()}@rguktsklm.ac.in`,
//         password: student.password,
//         name: student.name,
//         gender: student.gender,
//         role: 'student',
//         classId,
//         className,
//         createdAt: serverTimestamp(),
//         createdBy
//       });
//       createdStudents.push({ oderId: studentId, studentId: student.id, name: student.name });
//     });

//     await batch.commit();

//     await updateDoc(classRef, {
//       studentCount: createdStudents.length,
//       studentIds: createdStudents.map(s => s.oderId) 
//     });

//     return { 
//       success: true, 
//       classId, 
//       createdCount: createdStudents.length,
//       totalCount: studentsData.length,
//       errors 
//     };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// };

// ==================== CLASS SERVICES ====================

export const getAllClasses = async (adminId, force = false) => {
  if (!adminId) return { success: false, error: "No Admin ID" };

  return withCache(keys.classes(adminId), TTL.LONG, async () => {
    try {
      const q = query(collection(db, 'classes'), where('createdBy', '==', adminId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      data.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const updateClassesOrder = async (classIds) => {
  try {
    const batch = writeBatch(db);
    classIds.forEach((id, index) => batch.update(doc(db, 'classes', id), { order: index }));
    await batch.commit();
    invalidatePrefix('classes:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClassById = async (classId, force = false) => {
  return withCache(keys.classById(classId), TTL.LONG, async () => {
    try {
      const classDoc = await getDoc(doc(db, 'classes', classId));
      if (classDoc.exists()) return { success: true, data: { id: classDoc.id, ...classDoc.data() } };
      return { success: false, error: 'Class not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const updateClass = async (classId, data) => {
  try {
    await updateDoc(doc(db, 'classes', classId), data);
    invalidateClassCaches(classId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteClass = async (classId) => {
  try {
    const classDoc = await getDoc(doc(db, 'classes', classId));
    let studentIds = [];
    
    if (classDoc.exists()) {
      studentIds = classDoc.data().studentIds || [];
      
      // Fallback: If studentIds array is missing (old data), query the users collection
      if (studentIds.length === 0) {
        const q = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', classId));
        const snapshot = await getDocs(q);
        studentIds = snapshot.docs.map(doc => doc.id);
      }
    }
    
    if (studentIds.length > 0) {
      for (let i = 0; i < studentIds.length; i += 500) {
        const batch = writeBatch(db);
        studentIds.slice(i, i + 500).forEach(id => batch.delete(doc(db, 'users', id)));
        await batch.commit();
      }
    }
    
    await deleteDoc(doc(db, 'classes', classId));

    // Detach the class from every subject that referenced it. Without this the
    // subject keeps the entry and teachers see a phantom class with no
    // students, which they can still click through to take attendance for.
    // Re-running this is harmless, so a failure mid-way is safe to retry.
    const referencing = await getDocs(query(
      collection(db, 'subjects'),
      where('classIds', 'array-contains', classId)
    ));

    if (!referencing.empty) {
      const batch = writeBatch(db);
      referencing.docs.forEach(subjectDoc => {
        const remaining = (subjectDoc.data().classes || []).filter(c => c.classId !== classId);
        batch.update(subjectDoc.ref, {
          classes: remaining,
          classIds: arrayRemove(classId),
          [`classNames.${classId}`]: deleteField(),
          [`classDates.${classId}`]: deleteField(),
          [`dateCapacities.${classId}`]: deleteField()
        });
      });
      await batch.commit();
      invalidateSubjectCaches();
    }

    invalidateClassCaches(classId);
    invalidatePrefix('users:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== SEMESTER MANAGEMENT ====================

export const createSemester = async (semesterData) => {
  try {
    const docRef = await addDoc(collection(db, 'semesters'), { ...semesterData, createdAt: serverTimestamp() });
    invalidatePrefix('semesters:');
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSemestersByTeacher = async (teacherId) => {
  try {
    const q = query(collection(db, 'semesters'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    let semesters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semesters.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    return { success: true, data: semesters };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSemesterById = async (semesterId, force = false) => {
  return withCache(keys.semesterById(semesterId), TTL.DAY, async () => {
    try {
      const semesterDoc = await getDoc(doc(db, 'semesters', semesterId));
      if (semesterDoc.exists()) return { success: true, data: { id: semesterDoc.id, ...semesterDoc.data() } };
      return { success: false, error: 'Semester not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const updateSemester = async (semesterId, data) => {
  try {
    await updateDoc(doc(db, 'semesters', semesterId), data);
    invalidatePrefix('semesters:');
    invalidate(keys.semesterById(semesterId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteSemester = async (semesterId) => {
  try {
    const subjectsQuery = query(collection(db, 'subjects'), where('semesterId', '==', semesterId));
    const subjectsSnapshot = await getDocs(subjectsQuery);

    const attendanceQuery = query(collection(db, 'attendance'), where('semesterId', '==', semesterId));
    const attendanceSnapshot = await getDocs(attendanceQuery);

    const ops = [];
    const docsToDelete = [...attendanceSnapshot.docs, ...subjectsSnapshot.docs];
    for (let i = 0; i < docsToDelete.length; i += 500) {
      const b = writeBatch(db);
      docsToDelete.slice(i, i + 500).forEach(d => b.delete(d.ref));
      ops.push(b.commit());
    }

    await Promise.all(ops);
    await deleteDoc(doc(db, 'semesters', semesterId));

    invalidatePrefix('semesters:');
    invalidate(keys.semesterById(semesterId));
    invalidateSubjectCaches(null, semesterId);
    invalidatePrefix('att:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== SUBJECT MANAGEMENT ====================

export const createSubject = async (subjectData, adminId = null) => {
  try {
    let classIds = [];
    let classNames = {};
    
    // Auto-populate classIds and classNames if provided in subjectData
    if (subjectData.classId) {
      classIds.push(subjectData.classId);
      if (subjectData.className) {
        classNames[subjectData.classId] = subjectData.className;
      }
    }
    
    if (subjectData.classes && Array.isArray(subjectData.classes)) {
      subjectData.classes.forEach(c => {
        if (!classIds.includes(c.classId)) classIds.push(c.classId);
        classNames[c.classId] = c.className;
      });
    }

    const docRef = await addDoc(collection(db, 'subjects'), {
      ...subjectData,
      createdBy: adminId,
      classIds: classIds,
      classNames: classNames,
      attendanceDates: [],
      classDates: {},
      dateCapacities: {},
      createdAt: serverTimestamp()
    });
    invalidateSubjectCaches(docRef.id, subjectData.semesterId);
    classIds.forEach(id => invalidate(keys.subjectsForStudent(id)));
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSubjectsByTeacher = async (teacherId, force = false) => {
  return withCache(keys.subjectsByTeacher(teacherId), TTL.LONG, async () => {
    try {
      const q = query(collection(db, 'subjects'), where('teacherId', '==', teacherId));
      const snapshot = await getDocs(q);
      let subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      subjects.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data: subjects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const getSubjectsBySemester = async (semesterId, force = false) => {
  return withCache(keys.subjectsBySemester(semesterId), TTL.LONG, async () => {
    try {
      const q = query(collection(db, 'subjects'), where('semesterId', '==', semesterId));
      const snapshot = await getDocs(q);
      let subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // ✅ Sort by 'order' field (Excel order) if exists, otherwise by createdAt
      subjects.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order; // Ascending order (Excel order)
        }
        return ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // Fallback: newest first
      });

      return { success: true, data: subjects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const getSubjectById = async (subjectId, force = false) => {
  return withCache(keys.subjectById(subjectId), TTL.MEDIUM, async () => {
    try {
      const subjectDoc = await getDoc(doc(db, 'subjects', subjectId));
      if (subjectDoc.exists()) return { success: true, data: { id: subjectDoc.id, ...subjectDoc.data() } };
      return { success: false, error: 'Subject not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const addClassToSubject = async (subjectId, classId, className) => {
  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      [`classNames.${classId}`]: className,
      classIds: arrayUnion(classId)
    });
    invalidateSubjectCaches(subjectId);
    invalidate(keys.subjectsForStudent(classId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const removeClassFromSubject = async (subjectId, classId) => {
  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      [`classNames.${classId}`]: deleteField(),
      classIds: arrayRemove(classId)
    });
    invalidateSubjectCaches(subjectId);
    invalidate(keys.subjectsForStudent(classId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Subjects taught to a class.
 *
 * Cached for an hour: this runs on every student dashboard load and the data
 * only changes when an admin reassigns classes.
 *
 * The legacy "scan every subject in the database" fallback was removed — at
 * 40+ subjects it read the entire collection for any class with no subjects
 * yet, on every single load. Subjects written by the current code always carry
 * `classIds`, and the `classId` fallback still covers older single-class docs.
 */
export const getSubjectsForStudent = async (classId, force = false) => {
  if (!classId) return { success: true, data: [] };

  return withCache(keys.subjectsForStudent(classId), TTL.LONG, async () => {
    try {
      const q = query(collection(db, 'subjects'), where('classIds', 'array-contains', classId));
      const snapshot = await getDocs(q);
      let subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fallback: old data where classId was stored as a single string field
      if (subjects.length === 0) {
        const fallbackQ = query(collection(db, 'subjects'), where('classId', '==', classId));
        const fallbackSnapshot = await getDocs(fallbackQ);
        subjects = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      return { success: true, data: subjects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const deleteSubject = async (subjectId) => {
  try {
    const subjectSnap = await getDoc(doc(db, 'subjects', subjectId));
    const data = subjectSnap.exists() ? subjectSnap.data() : {};
    await deleteDoc(doc(db, 'subjects', subjectId));

    invalidateSubjectCaches(subjectId, data.semesterId);
    (data.classIds || []).forEach(id => invalidate(keys.subjectsForStudent(id)));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAllSubjects = async (adminId = null, force = false) => {
  return withCache(keys.allSubjects(adminId), TTL.LONG, async () => {
    try {
      let q;
      if (adminId) {
        q = query(collection(db, 'subjects'), where('createdBy', '==', adminId));
      } else {
        q = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);
      let subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (adminId) {
        subjects.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      }

      return { success: true, data: subjects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};


// Add this inside SUBJECT MANAGEMENT section (after getAllSubjects):
export const createSubjectsFromExcel = async (subjectsData, semesterId, semesterName, adminId) => {
  try {
    const created = [];
    const errors = [];
    const skippedDuplicates = [];

    // Get existing subject codes in this semester to skip duplicates
    const existingSubsQuery = await getDocs(query(
      collection(db, 'subjects'),
      where('semesterId', '==', semesterId)
    ));
    const existingCodes = new Set(
      existingSubsQuery.docs.map(d => (d.data().code || '').toUpperCase().trim())
    );

    subjectsData.forEach((row, index) => {
      const subjectName = (row.Subject || '').trim();
      const subjectCode = (row['Subject Code'] || '').trim().toUpperCase();
      const excelTeacherName = (row.Teacher || '').trim();
      
      const matchedTeacherId = row.matchedTeacherId || null;
      const matchedTeacherName = row.matchedTeacherName || excelTeacherName;
      const matchStatus = row.matchStatus || 'none';

      if (!subjectName) {
        errors.push(`Row ${index + 2}: Missing Subject name`);
        return;
      }
      if (!subjectCode) {
        errors.push(`Row ${index + 2}: Missing Subject Code`);
        return;
      }
      if (!excelTeacherName) {
        errors.push(`Row ${index + 2}: Missing Teacher name`);
        return;
      }

      if (existingCodes.has(subjectCode)) {
        skippedDuplicates.push(`${subjectCode} — already exists`);
        return;
      }

      created.push({
        name: subjectName,
        code: subjectCode,
        teacherId: matchedTeacherId,
        teacherName: matchedTeacherName,
        excelTeacherName,
        matchStatus,
        semesterId,
        semesterName,
        createdBy: adminId,
        order: index,  // ✅ ADD THIS LINE
        classIds: [],
        classNames: {},
        attendanceDates: [],
        classDates: {},
        dateCapacities: {},
        createdAt: serverTimestamp()
      });
    });

    // Batch create all subjects
    const batch = writeBatch(db);
    created.forEach(subject => {
      const docRef = doc(collection(db, 'subjects'));
      batch.set(docRef, subject);
    });
    await batch.commit();

    invalidateSubjectCaches(null, semesterId);
    return {
      success: true,
      created,
      errors,
      skippedDuplicates,
      totalCount: subjectsData.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
// ==================== ATTENDANCE MANAGEMENT ====================

/** Full re-download of a cached attendance set at most once a day. */
const FULL_RESYNC_INTERVAL = 24 * 60 * 60 * 1000;

/** Merge freshly fetched docs over cached ones, keyed by document id. */
const mergeRecordsById = (cached, fresh) => {
  const byId = new Map((cached || []).map(rec => [rec.id, rec]));
  (fresh || []).forEach(rec => byId.set(rec.id, rec));
  return Array.from(byId.values());
};

/** Latest date present in a record set — the incremental sync watermark. */
const latestDate = (records) =>
  (records || []).reduce((max, rec) => (rec.date > max ? rec.date : max), '');

/**
 * Roll a set of attendance changes into the class document.
 *
 * Per-student attendance totals live on the class doc as
 *   attendanceStats[studentId][subjectId] = { present, total }
 *
 * so an admin can see who is below 75% by reading ONE document per class
 * instead of querying every student's attendance history. Writing them is a
 * single update for the whole class, not one write per student.
 *
 * @param {string} classId
 * @param {Array<{studentId, subjectId, presentDelta, totalDelta}>} deltas
 */
export const applyClassAttendanceDelta = async (classId, deltas) => {
  try {
    if (!classId || !deltas?.length) return { success: true, skipped: true };

    const payload = {};
    deltas.forEach(({ studentId, subjectId, presentDelta, totalDelta }) => {
      if (!studentId || !subjectId) return;
      if (presentDelta) {
        payload[`attendanceStats.${studentId}.${subjectId}.present`] = increment(presentDelta);
      }
      if (totalDelta) {
        payload[`attendanceStats.${studentId}.${subjectId}.total`] = increment(totalDelta);
      }
    });

    if (Object.keys(payload).length === 0) return { success: true, skipped: true };

    payload.attendanceStatsUpdatedAt = serverTimestamp();
    await updateDoc(doc(db, 'classes', classId), payload);

    invalidate(keys.classById(classId));
    invalidatePrefix('classes:');
    return { success: true };
  } catch (error) {
    // Stats are an optimisation, never the source of truth — a failure here
    // must not fail the attendance save that triggered it.
    console.error('Failed to update class attendance stats:', error?.message);
    return { success: false, error: error.message };
  }
};

/**
 * Save a whole session's attendance in one go.
 *
 * The old flow called markAttendance once per student, and each of those calls
 * ALSO wrote the shared subject document — 60 students meant 120 writes and 60
 * conflicting updates to the same doc. This writes the student records as one
 * batch, touches the subject document once, and updates the class totals once.
 *
 * Re-saving a date already recorded computes a delta from the existing records
 * so totals stay correct instead of double counting.
 *
 * @param {Object} session - { subjectId, classId, date, records, meta }
 *   records: [{ oderId, studentId, studentName, status, count, maxCount }]
 *   meta:    fields copied onto every record (subjectName, semesterId, ...)
 */
export const saveSessionAttendance = async ({ subjectId, classId, date, records, meta = {} }) => {
  try {
    if (!subjectId || !classId || !date || !records?.length) {
      return { success: false, error: 'Missing session details' };
    }

    // Was this date already recorded? The subject document tracks which dates
    // exist per class, so the normal "new session" case needs no record lookup.
    //
    // Read it fresh rather than from cache: a stale copy could miss a date that
    // was already saved, and the rollup would then count that session twice.
    let previousById = new Map();
    const subjectRes = await getSubjectById(subjectId, true);
    const trackedDates = subjectRes.success ? subjectRes.data.classDates?.[classId] : undefined;

    // Older subjects predate classDates; for those, always check for records
    // rather than assume the date is new.
    const mayHavePrevious = Array.isArray(trackedDates)
      ? trackedDates.includes(date)
      : true;

    if (mayHavePrevious) {
      const existing = await getDocs(query(
        collection(db, 'attendance'),
        where('subjectId', '==', subjectId),
        where('classId', '==', classId),
        where('date', '==', date)
      ));
      existing.docs.forEach(d => previousById.set(d.id, d.data()));
    }

    const sessionMaxCount = records.reduce(
      (max, rec) => Math.max(max, rec.maxCount || rec.count || 1), 1
    );

    // 1. Attendance records — one batched write per student
    const batch = writeBatch(db);
    const deltas = [];

    records.forEach(rec => {
      const docId = `${rec.oderId}_${subjectId}_${date}`;
      const recMaxCount = rec.maxCount || sessionMaxCount;

      // A student can never attend more periods than the session had. Callers
      // hold count and maxCount in separate pieces of state, so a UI that lets
      // one change after the other was set can submit count > maxCount, which
      // rolls up as more-than-100% attendance. Clamp here so no caller can put
      // an impossible figure into the totals.
      const safeCount = Math.min(Math.max(rec.count ?? 1, 0), recMaxCount);
      const payload = {
        ...meta,
        subjectId,
        classId,
        date,
        oderId: rec.oderId,
        studentId: rec.studentId,
        studentName: rec.studentName,
        status: rec.status,
        count: safeCount,
        maxCount: recMaxCount,
        sessionType: rec.sessionType || meta.sessionType || 'class',
        semesterId: meta.semesterId || null,
        updatedAt: serverTimestamp()
      };
      batch.set(doc(db, 'attendance', docId), payload, { merge: true });

      // Delta vs whatever was stored for this student on this date before
      const prev = previousById.get(docId);
      const prevPresent = prev?.status === 'present' ? (prev.count || 1) : 0;
      const prevTotal = prev ? (prev.maxCount || prev.count || 1) : 0;
      const nowPresent = rec.status === 'present' ? safeCount : 0;
      const nowTotal = recMaxCount;

      deltas.push({
        studentId: rec.oderId,
        subjectId,
        presentDelta: nowPresent - prevPresent,
        totalDelta: nowTotal - prevTotal
      });
    });

    await batch.commit();

    // ✅ NEW: Send emails to absent students via Cloudflare Worker
    const absentStudents = records
      .filter(rec => rec.status === 'absent')
      .map(rec => ({
        name: rec.studentName,
        email: `${rec.studentId.toLowerCase()}@rguktsklm.ac.in`
      }));

    if (absentStudents.length > 0 && process.env.REACT_APP_WORKER_URL) {
      console.log(`📝 Attempting to send emails to ${absentStudents.length} absent students...`);
      console.log("Student Data being sent:", absentStudents);
      
      try {
        const response = await fetch(process.env.REACT_APP_WORKER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': process.env.REACT_APP_WORKER_SECRET
          },
          body: JSON.stringify({
            students: absentStudents,
            meta: {
              subjectName: meta.subjectName,
              date: date,
              time: meta.time,
              teacherName: meta.teacherName
            }
          })
        });
        
        const data = await response.json();
        console.log("✅ Cloudflare Worker Response:", data);

        // If Brevo rejected the emails, this will print the EXACT reason why!
        if (data.details) {
          data.details.forEach(d => {
            if (!d.success) {
              console.error(`❌ Failed to send to ${d.email}. Brevo Error:`, d.brevoError);
            }
          });
        } else if (!data.success) {
          console.error("❌ Worker Error:", data.error);
        }

      } catch (emailError) {
        console.error("🚨 Network error calling Cloudflare Worker:", emailError);
      }
    } else {
      if (absentStudents.length === 0) {
        console.log("ℹ️ No absent students found, no emails sent.");
      } else if (!process.env.REACT_APP_WORKER_URL) {
        console.warn("⚠️ REACT_APP_WORKER_URL is missing in your .env file!");
      }
    }
    // --- END NEW CODE ---

    // 2. Subject document — once for the whole session, not once per student
    await updateDoc(doc(db, 'subjects', subjectId), {
      attendanceDates: arrayUnion(date),
      [`classDates.${classId}`]: arrayUnion(date),
      [`dateCapacities.${classId}.${date}`]: sessionMaxCount
    });

    // 3. Class rollup — one write covering every student in the session
    await applyClassAttendanceDelta(classId, deltas);

    invalidate(keys.subjectById(subjectId));
    invalidate(keys.subjectClassAttendance(subjectId, classId));
    records.forEach(rec => invalidate(keys.studentAttendance(rec.oderId)));

    return { success: true, savedCount: records.length, wasUpdate: previousById.size > 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Save a single attendance record.
 * Retained for one-off writes; prefer saveSessionAttendance for a whole class.
 */
export const markAttendance = async (data) => {
  try {
    const docId = `${data.oderId}_${data.subjectId}_${data.date}`;
    const docRef = doc(db, 'attendance', docId);

    await setDoc(docRef, {
      ...data,
      semesterId: data.semesterId || null,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const subjectRef = doc(db, 'subjects', data.subjectId);
    await updateDoc(subjectRef, {
      attendanceDates: arrayUnion(data.date),
      [`classDates.${data.classId}`]: arrayUnion(data.date),
      [`dateCapacities.${data.classId}.${data.date}`]: data.maxCount || data.count || 1
    });

    invalidate(keys.subjectById(data.subjectId));
    invalidate(keys.studentAttendance(data.oderId));
    invalidate(keys.subjectClassAttendance(data.subjectId, data.classId));

    return { success: true, action: 'saved' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAttendanceBySubjectAndDate = async (subjectId, date) => {
  try {
    const q = query(collection(db, 'attendance'), where('subjectId', '==', subjectId), where('date', '==', date));
    const snapshot = await getDocs(q);
    return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAttendanceBySubjectClassAndDate = async (subjectId, classId, date) => {
  try {
    const q = query(collection(db, 'attendance'), where('subjectId', '==', subjectId), where('classId', '==', classId), where('date', '==', date));
    const snapshot = await getDocs(q);
    return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Attendance for a subject + class, synced incrementally.
 *
 * A teacher opening the sheet used to re-read every record every time (a class
 * of 60 with 40 sessions = 2,400 reads per view). Now the cached copy is topped
 * up with records dated on or after the last sync, so repeat views cost only
 * what actually changed.
 */
export const getAttendanceForSubjectAndClass = async (subjectId, classId, options = {}) => {
  const { force = false, freshWindow = TTL.SHORT } = options;
  const cacheKey = keys.subjectClassAttendance(subjectId, classId);
  const entry = force ? null : getCacheEntry(cacheKey);
  const now = Date.now();

  const sortAsc = (list) => [...list].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Synced moments ago — serve from cache, no reads at all
  if (entry?.data?.records && now - entry.savedAt < freshWindow) {
    return { success: true, data: sortAsc(entry.data.records), fromCache: true };
  }

  // Top up: only records on/after the last known date
  if (entry?.data?.records?.length && entry.data.syncedThrough &&
      now - (entry.data.fullFetchAt || 0) < FULL_RESYNC_INTERVAL) {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('subjectId', '==', subjectId),
        where('classId', '==', classId),
        where('date', '>=', entry.data.syncedThrough)
      );
      const snapshot = await getDocs(q);
      const fresh = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const merged = mergeRecordsById(entry.data.records, fresh);

      setCache(cacheKey, {
        records: merged,
        syncedThrough: latestDate(merged) || entry.data.syncedThrough,
        fullFetchAt: entry.data.fullFetchAt
      });
      return { success: true, data: sortAsc(merged), incremental: true };
    } catch (error) {
      // Composite index not deployed yet — fall through to a full fetch
    }
  }

  try {
    const q = query(
      collection(db, 'attendance'),
      where('subjectId', '==', subjectId),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    setCache(cacheKey, {
      records: data,
      syncedThrough: latestDate(data),
      fullFetchAt: now
    });
    return { success: true, data: sortAsc(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * A student's own attendance history, synced incrementally.
 *
 * This was the single most expensive query in the app: every dashboard load
 * re-read every record the student had ever accumulated (~330 docs, and rising
 * all semester). At 1,500 students that alone was roughly 500,000 reads a day.
 *
 * Now the history is cached on the device and only records dated on or after
 * the last sync are fetched, so a returning student costs a handful of reads.
 * Re-reading the most recent day (>= rather than >) means same-day corrections
 * by a teacher are still picked up, and the whole set is refreshed daily.
 */
export const getAttendanceForStudent = async (oderId, options = {}) => {
  const { force = false, freshWindow = TTL.SHORT } = options;
  if (!oderId) return { success: true, data: [] };

  const cacheKey = keys.studentAttendance(oderId);
  const entry = force ? null : getCacheEntry(cacheKey);
  const now = Date.now();

  const sortDesc = (list) => [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (entry?.data?.records && now - entry.savedAt < freshWindow) {
    return { success: true, data: sortDesc(entry.data.records), fromCache: true };
  }

  if (entry?.data?.records?.length && entry.data.syncedThrough &&
      now - (entry.data.fullFetchAt || 0) < FULL_RESYNC_INTERVAL) {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('oderId', '==', oderId),
        where('date', '>=', entry.data.syncedThrough)
      );
      const snapshot = await getDocs(q);
      const fresh = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const merged = mergeRecordsById(entry.data.records, fresh);

      setCache(cacheKey, {
        records: merged,
        syncedThrough: latestDate(merged) || entry.data.syncedThrough,
        fullFetchAt: entry.data.fullFetchAt
      });
      return { success: true, data: sortDesc(merged), incremental: true };
    } catch (error) {
      // Needs the (oderId, date) composite index — fall back to a full fetch
    }
  }

  try {
    const q = query(collection(db, 'attendance'), where('oderId', '==', oderId));
    const snapshot = await getDocs(q);
    const attendance = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    setCache(cacheKey, {
      records: attendance,
      syncedThrough: latestDate(attendance),
      fullFetchAt: now
    });
    return { success: true, data: sortDesc(attendance) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Apply edited attendance records and keep the class rollup in step.
 * @param {Array} updates - [{ id, oderId, subjectId, classId, status, count, maxCount, previous }]
 */
export const updateAttendanceBatch = async (updates) => {
  try {
    if (!updates?.length) return { success: true };

    const batch = writeBatch(db);
    const deltasByClass = {};

    updates.forEach(item => {
      batch.update(doc(db, 'attendance', item.id), {
        status: item.status,
        count: item.count ?? 1,
        editedAt: serverTimestamp()
      });

      const prev = item.previous || {};
      const prevPresent = prev.status === 'present' ? (prev.count || 1) : 0;
      const prevTotal = prev.maxCount || prev.count || 1;
      const nowPresent = item.status === 'present' ? (item.count ?? 1) : 0;
      const nowTotal = item.maxCount || prevTotal;

      if (!item.classId) return;
      if (!deltasByClass[item.classId]) deltasByClass[item.classId] = [];
      deltasByClass[item.classId].push({
        studentId: item.oderId,
        subjectId: item.subjectId,
        presentDelta: nowPresent - prevPresent,
        totalDelta: nowTotal - prevTotal
      });
    });

    await batch.commit();

    await Promise.all(
      Object.entries(deltasByClass).map(([classId, deltas]) =>
        applyClassAttendanceDelta(classId, deltas)
      )
    );

    updates.forEach(item => {
      invalidate(keys.studentAttendance(item.oderId));
      if (item.subjectId && item.classId) {
        invalidate(keys.subjectClassAttendance(item.subjectId, item.classId));
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAllAttendance = async (force = false) => {
  return withCache('att:recent', TTL.MEDIUM, async () => {
    try {
      const safetyQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(150));
      const snapshot = await getDocs(safetyQuery);
      return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

// Both date lookups read the subject document (cached) first — the dates are
// already denormalised there, so the attendance collection is only touched for
// legacy subjects that predate that field.

export const getAttendanceDatesForSubject = async (subjectId) => {
  try {
    const subjectRes = await getSubjectById(subjectId);
    if (subjectRes.success && subjectRes.data.attendanceDates?.length > 0) {
      return {
        success: true,
        data: [...subjectRes.data.attendanceDates].sort((a, b) => new Date(b) - new Date(a))
      };
    }
    const q = query(collection(db, 'attendance'), where('subjectId', '==', subjectId));
    const snapshot = await getDocs(q);
    const dates = [...new Set(snapshot.docs.map(doc => doc.data().date))];
    return { success: true, data: dates.sort((a, b) => new Date(b) - new Date(a)) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAttendanceDatesForSubjectAndClass = async (subjectId, classId) => {
  try {
    const subjectRes = await getSubjectById(subjectId);
    if (subjectRes.success) {
      const dates = subjectRes.data.classDates?.[classId] || [];
      if (dates.length > 0) return { success: true, data: [...dates].sort() };
    }
    const q = query(collection(db, 'attendance'), where('subjectId', '==', subjectId), where('classId', '==', classId));
    const snapshot = await getDocs(q);
    const dates = [...new Set(snapshot.docs.map(doc => doc.data().date))];
    return { success: true, data: dates.sort() };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAllSemesters = async (adminId = null, force = false) => {
  return withCache(keys.semesters(adminId), TTL.DAY, async () => {
    try {
      let q = adminId
        ? query(collection(db, 'semesters'), where('createdBy', '==', adminId))
        : query(collection(db, 'semesters'));
      const snapshot = await getDocs(q);
      let semesters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      semesters.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data: semesters };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

// ==================== ANNOUNCEMENTS MANAGEMENT ====================

export const createAnnouncement = async (announcementData) => {
  try {
    const docRef = await addDoc(collection(db, 'announcements'), { ...announcementData, createdAt: serverTimestamp() });
    invalidatePrefix('ann:');
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Timestamp (ms) of the newest announcement for a class, or 0 if none.
 *
 * The navbar shows an "unread" dot on every page, and because each page mounts
 * its own navbar, it previously re-read EVERY announcement for the class on
 * every navigation just to find the newest one. This reads a single document,
 * and the short cache means rapid navigation costs nothing at all.
 *
 * Falls back to the unordered query if the (classId, createdAt) composite index
 * has not been deployed.
 */
export const getLatestAnnouncementTime = async (classId, force = false) => {
  if (!classId) return { success: true, data: 0 };

  return withCache(`ann:latest:${classId}`, TTL.SHORT, async () => {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('classId', '==', classId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return { success: true, data: 0 };
      const seconds = snapshot.docs[0].data().createdAt?.seconds || 0;
      return { success: true, data: seconds * 1000 };
    } catch (error) {
      // Index missing — fall back to scanning the class's announcements
      try {
        const snapshot = await getDocs(
          query(collection(db, 'announcements'), where('classId', '==', classId))
        );
        const latest = snapshot.docs.reduce(
          (max, d) => Math.max(max, d.data().createdAt?.seconds || 0), 0
        );
        return { success: true, data: latest * 1000 };
      } catch (fallbackError) {
        return { success: false, error: fallbackError.message, data: 0 };
      }
    }
  }, force);
};

/**
 * Live announcements for a class.
 *
 * Announcements are realtime: a student sees a new post the moment a teacher
 * publishes it, with no refresh.
 *
 * Two things keep that affordable:
 *  - The cached copy is handed back synchronously, so the page paints instantly
 *    instead of showing a spinner while the first snapshot arrives.
 *  - Firestore's persistent cache (enabled in config.js) lets a re-attached
 *    listener resume from where it left off and download only what changed,
 *    rather than re-reading the whole collection on every navigation.
 *
 * Every snapshot refreshes the cache, so the navbar and other pages stay in
 * step without issuing reads of their own.
 *
 * @param {string} classId
 * @param {Function} onData - called with the announcement array, newest first
 * @param {Function} [onError]
 * @returns {Function} unsubscribe
 */
export const subscribeToClassAnnouncements = (classId, onData, onError) => {
  if (!classId) {
    onData([]);
    return () => {};
  }

  const cacheKey = `ann:class:${classId}`;

  // Paint from cache first — the listener will correct it moments later.
  const cached = getCache(cacheKey, TTL.DAY);
  if (cached) onData(cached, { fromCache: true });

  const q = query(collection(db, 'announcements'), where('classId', '==', classId));

  return onSnapshot(
    q,
    (snapshot) => {
      const announcements = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));

      setCache(cacheKey, announcements);

      // Keep the navbar's "newest announcement" value in step for free
      const latest = announcements[0]?.createdAt?.seconds || 0;
      setCache(`ann:latest:${classId}`, latest * 1000);

      onData(announcements, { fromCache: snapshot.metadata.fromCache });
    },
    (error) => {
      console.error('Announcement subscription failed:', error?.message);
      if (onError) onError(error);
    }
  );
};

/**
 * Live "is there something new?" signal for the navbar dot.
 *
 * Watches only the single newest announcement rather than the whole
 * collection — the navbar is mounted by all 28 pages, so a full-collection
 * listener here re-read everything on every navigation.
 *
 * Falls back to a cached one-shot fetch when the (classId, createdAt) index
 * has not been deployed.
 *
 * @param {string} classId
 * @param {Function} onTime - called with the newest announcement time in ms
 * @returns {Function} unsubscribe
 */
export const subscribeToLatestAnnouncement = (classId, onTime) => {
  if (!classId) {
    onTime(0);
    return () => {};
  }

  const cached = getCache(`ann:latest:${classId}`, TTL.DAY);
  if (typeof cached === 'number') onTime(cached);

  let cancelled = false;

  try {
    const q = query(
      collection(db, 'announcements'),
      where('classId', '==', classId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return;
        const seconds = snapshot.empty ? 0 : (snapshot.docs[0].data().createdAt?.seconds || 0);
        const ms = seconds * 1000;
        setCache(`ann:latest:${classId}`, ms);
        onTime(ms);
      },
      async (error) => {
        // Most likely a missing composite index — degrade to a one-off read
        console.warn('Latest-announcement listener unavailable:', error?.message);
        const res = await getLatestAnnouncementTime(classId);
        if (!cancelled && res.success) onTime(res.data);
      }
    );

    return () => { cancelled = true; unsubscribe(); };
  } catch (error) {
    getLatestAnnouncementTime(classId).then(res => {
      if (!cancelled && res.success) onTime(res.data);
    });
    return () => { cancelled = true; };
  }
};

export const getAnnouncementsByClass = async (classId, force = false) => {
  if (!classId) return { success: true, data: [] };

  return withCache(`ann:class:${classId}`, TTL.SHORT, async () => {
    try {
      const q = query(collection(db, 'announcements'), where('classId', '==', classId));
      const snapshot = await getDocs(q);
      let announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      announcements.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data: announcements };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const getAnnouncementsByTeacher = async (teacherId, force = false) => {
  return withCache(keys.announcementsByTeacher(teacherId), TTL.MEDIUM, async () => {
    try {
      const q = query(collection(db, 'announcements'), where('teacherId', '==', teacherId));
      const snapshot = await getDocs(q);
      let announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      announcements.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data: announcements };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

export const deleteAnnouncement = async (announcementId) => {
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
    invalidatePrefix('ann:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Update a subject. When class assignments change, `classIds`/`classNames`
 * are kept in step with the `classes` array so the student-facing
 * array-contains query keeps working.
 */
export const updateSubject = async (subjectId, data) => {
  try {
    const payload = { ...data };

    if (Array.isArray(data.classes)) {
      payload.classIds = data.classes.map(c => c.classId).filter(Boolean);
      payload.classNames = data.classes.reduce((acc, c) => {
        if (c.classId) acc[c.classId] = c.className;
        return acc;
      }, {});
    }

    await updateDoc(doc(db, 'subjects', subjectId), payload);

    invalidateSubjectCaches(subjectId, data.semesterId);
    (payload.classIds || []).forEach(id => invalidate(keys.subjectsForStudent(id)));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== NOTIFICATION TOKENS ====================

export const saveFCMToken = async (userId, token) => {
  try {
    await setDoc(doc(db, 'fcmTokens', userId), { token, updatedAt: serverTimestamp() }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== TEACHER ACTIVITY LOG ====================

export const logTeacherActivity = async (data) => {
  try {
    await addDoc(collection(db, 'teacherActivity'), { ...data, createdAt: serverTimestamp() });
    invalidatePrefix('activity:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateTeacherActivity = async (logId, data) => {
  try {
    await updateDoc(doc(db, 'teacherActivity', logId), { ...data, updatedAt: serverTimestamp() });
    invalidatePrefix('activity:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteTeacherActivity = async (logId) => {
  try {
    await deleteDoc(doc(db, 'teacherActivity', logId));
    invalidatePrefix('activity:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getTeacherActivity = async (teacherId, subjectId, force = false) => {
  return withCache(keys.teacherActivity(teacherId, subjectId), TTL.MEDIUM, async () => {
    try {
      let q = subjectId && subjectId !== 'all'
        ? query(collection(db, 'teacherActivity'), where('teacherId', '==', teacherId), where('subjectId', '==', subjectId))
        : query(collection(db, 'teacherActivity'), where('teacherId', '==', teacherId));

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data: logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

// ✅✅✅ NEW: Sync unit/topic changes to attendance records ✅✅✅
export const updateAttendanceForActivityLog = async (subjectId, date, newUnit, newTopic, classId = null) => {
  try {
    const constraints = [
      where('subjectId', '==', subjectId),
      where('date', '==', date)
    ];

    if (classId) {
      constraints.push(where('classId', '==', classId));
    }

    const q = query(collection(db, 'attendance'), ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return { success: true, updatedCount: 0 };

    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        unit: newUnit,
        topic: newTopic,
        editedAt: serverTimestamp()
      });
    });

    await batch.commit();
    // The attendance sheet caches these records; without this the edited unit
    // and topic would not show until the cache expired.
    invalidatePrefix(`att:sc:${subjectId}`);
    return { success: true, updatedCount: snapshot.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== CR MANAGEMENT ====================

export const assignCRs = async (classId, crIds) => {
  try {
    if (crIds.length > 4) throw new Error("Maximum 4 CRs allowed");
    await updateDoc(doc(db, 'classes', classId), { crIds });
    invalidateClassCaches(classId);
    invalidatePrefix('cr:'); // CR status is cached per student
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClassCRs = async (classId) => {
  try {
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) return { success: false, error: 'Class not found' };
    
    const crIds = classDoc.data().crIds || [];
    if (crIds.length === 0) return { success: true, data: [] };

    const q = query(collection(db, 'users'), where(documentId(), 'in', crIds));
    const snapshot = await getDocs(q);
    return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Is this student a class representative?
 * Cached because it runs on every student dashboard mount and CR assignments
 * change perhaps once a semester.
 */
export const checkIfCR = async (studentId, force = false) => {
  const cacheKey = `cr:${studentId}`;
  if (!force) {
    const hit = getCacheEntry(cacheKey);
    if (hit && Date.now() - hit.savedAt < TTL.LONG) {
      return { success: true, ...hit.data, fromCache: true };
    }
  }

  try {
    const q = query(collection(db, 'classes'), where('crIds', 'array-contains', studentId));
    const snapshot = await getDocs(q);

    const result = !snapshot.empty
      ? { isCR: true, classData: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } }
      : { isCR: false };

    setCache(cacheKey, result);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== CLASS ATTENDANCE (CR) ====================

export const markClassAttendance = async (classId, date, records, markedBy) => {
  try {
    const docId = `${classId}_${date}`;
    const docRef = doc(db, 'classAttendance', docId);
    const existingDoc = await getDoc(docRef);

    if (existingDoc.exists()) {
      throw new Error("Attendance has already been submitted for this class today.");
    }

    await setDoc(docRef, { classId, date, records, markedBy, markedAt: serverTimestamp() });
    invalidate(keys.classAttendance(classId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateClassAttendance = async (recordId, records) => {
  try {
    await updateDoc(doc(db, 'classAttendance', recordId), { records, updatedAt: serverTimestamp() });
    invalidatePrefix('att:class:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClassAttendance = async (classId, force = false) => {
  return withCache(keys.classAttendance(classId), TTL.MEDIUM, async () => {
    try {
      const q = query(collection(db, 'classAttendance'), where('classId', '==', classId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

// ==================== CONTACT MESSAGES ====================

export const submitContactForm = async (data) => {
  try {
    await addDoc(collection(db, 'contactMessages'), { ...data, createdAt: serverTimestamp(), read: false });
    invalidate(keys.contactMessages());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getContactMessages = async (force = false) => {
  return withCache(keys.contactMessages(), TTL.SHORT, async () => {
    try {
      const snapshot = await getDocs(collection(db, 'contactMessages'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, force);
};

/** Unread message count without downloading the messages. */
export const getUnreadMessageCount = async () => {
  try {
    const snapshot = await getCountFromServer(
      query(collection(db, 'contactMessages'), where('read', '==', false))
    );
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    return { success: false, error: error.message, count: 0 };
  }
};

export const markMessageRead = async (id) => {
  try {
    await updateDoc(doc(db, 'contactMessages', id), { read: true });
    invalidate(keys.contactMessages());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== PASSWORD CHANGE ====================

export const changeStudentPassword = async (userId, currentPassword, newPassword) => {
  try {
    if (!userId) throw new Error("User ID is missing.");
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) throw new Error("User record not found in database.");
    if (userSnap.data().password !== currentPassword) return { success: false, error: 'Current password is incorrect.' };
    await updateDoc(doc(db, 'users', userId), { password: newPassword });
    // The roster caches hold a copy of this user document.
    invalidateUserCaches();
    invalidatePrefix('students:');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== CLASS UPDATE WITH STUDENTS ====================

export const updateClassWithStudents = async (classId, data, oldClassName = null) => {
  try {
    await updateDoc(doc(db, 'classes', classId), data);
    
    if (data.name && oldClassName && data.name !== oldClassName) {
      const classDoc = await getDoc(doc(db, 'classes', classId));
      let studentIds = classDoc.data().studentIds || [];
      
      // Fallback: If studentIds array is missing (old data), query the users collection
      if (studentIds.length === 0) {
        const q = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', classId));
        const snapshot = await getDocs(q);
        studentIds = snapshot.docs.map(doc => doc.id);
      }
      
      if (studentIds.length > 0) {
        for (let i = 0; i < studentIds.length; i += 500) {
          const batch = writeBatch(db);
          studentIds.slice(i, i + 500).forEach(id => batch.update(doc(db, 'users', id), { className: data.name }));
          await batch.commit();
        }
      }
    }

    invalidateClassCaches(classId);
    invalidateUserCaches(classId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== PAGINATED QUERIES ====================

// Both helpers previously named their page-size parameter `limit`, which
// shadowed Firestore's imported limit() and made every call throw
// "limit is not a function". Renamed to pageSize.

export const getStudentsByClassPaginated = async (classId, { pageSize = 20, startAfterDoc = null } = {}) => {
  try {
    const constraints = [
      where('role', '==', 'student'),
      where('classId', '==', classId),
      orderBy('order', 'asc')
    ];
    if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
    constraints.push(limit(pageSize));

    const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { success: true, data, lastDoc, hasMore: snapshot.docs.length === pageSize };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * A student's most recent attendance records only.
 * Used where a dashboard shows "last 5" — reading 5 documents instead of the
 * student's entire history.
 */
export const getRecentAttendance = async (studentId, pageSize = 5) => {
  try {
    const q = query(
      collection(db, 'attendance'),
      where('oderId', '==', studentId),
      orderBy('date', 'desc'),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


// ==================== DUPLICATE DETECTION ====================

export const createClassWithStudents = async (className, description, studentsData, createdBy) => {
  try {
    const classRef = await addDoc(collection(db, 'classes'), {
      name: className,
      description,
      studentCount: studentsData.length,
      createdBy,
      studentIds: [], 
      createdAt: serverTimestamp()
    });

    const classId = classRef.id;
    const createdStudents = [];
    const errors = [];
    const batch = writeBatch(db);

    const allIds = studentsData.map(s => s.id.toUpperCase());

    // Check duplicates WITHIN the upload
    const seenInUpload = new Set();
    const duplicateInUpload = new Set();
    allIds.forEach(id => {
      if (seenInUpload.has(id)) duplicateInUpload.add(id);
      seenInUpload.add(id);
    });

    // Check duplicates against ENTIRE users collection
    for (let i = 0; i < allIds.length; i += 30) {
      const chunk = allIds.slice(i, i + 30);
      const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
      const existingSnaps = await getDocs(q);
      existingSnaps.forEach(doc => {
        const existingClass = doc.data().className || 'Unknown Class';
        errors.push(`Duplicate: "${doc.id}" already exists in "${existingClass}" — skipped`);
      });
    }

    const existingSet = new Set(errors.map(e => e.split('"')[1]));

    studentsData.forEach(student => {
      const studentId = student.id.toUpperCase();
      if (duplicateInUpload.has(studentId)) return;
      if (existingSet.has(studentId)) return;

      const studentRef = doc(db, 'users', studentId);
      batch.set(studentRef, {
        uid: studentId,
        studentId: studentId,
        email: `${studentId.toLowerCase()}@rguktsklm.ac.in`,
        password: student.password,
        name: student.name,
        gender: student.gender,
        role: 'student',
        classId,
        className,
        createdAt: serverTimestamp(),
        createdBy
      });
      createdStudents.push({ oderId: studentId, studentId: student.id, name: student.name });
    });

    await batch.commit();

    await updateDoc(classRef, {
      studentCount: createdStudents.length,
      studentIds: createdStudents.map(s => s.oderId) 
    });

    invalidateClassCaches(classId);
    invalidateUserCaches(classId);
    return { 
      success: true, 
      classId, 
      createdCount: createdStudents.length,
      totalCount: studentsData.length,
      duplicateCount: errors.length + duplicateInUpload.size,
      errors 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


// ==================== ATTENDANCE STATS ====================

/**
 * Attendance totals for one class, read from the class document.
 *
 * This replaces the old approach of querying every student's full attendance
 * history: a 60-student class used to cost ~19,000 reads to work out who was
 * below 75%. It now costs ONE read, because saveSessionAttendance keeps a
 * per-student rollup on the class doc as attendance is taken.
 *
 * @param {string} classId
 * @param {Array} students - Roster (already loaded by the caller)
 * @returns {{success: boolean, data: Array, hasStats: boolean}}
 */
export const getClassAttendanceSummary = async (classId, students = [], force = false) => {
  try {
    const classRes = await getClassById(classId, force);
    if (!classRes.success) return { success: false, error: classRes.error, data: [], hasStats: false };

    const stats = classRes.data.attendanceStats || {};
    const hasStats = Object.keys(stats).length > 0;

    const summary = students.map(student => {
      const perSubject = stats[student.id] || {};
      let present = 0;
      let total = 0;

      Object.values(perSubject).forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        present += entry.present || 0;
        total += entry.total || 0;
      });

      return {
        ...student,
        stats: {
          present,
          absent: Math.max(total - present, 0),
          total,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0
        }
      };
    });

    return { success: true, data: summary, hasStats };
  } catch (error) {
    return { success: false, error: error.message, data: [], hasStats: false };
  }
};

/**
 * Students below a threshold in one class — one document read.
 */
export const getClassLowAttendance = async (classId, students = [], threshold = 75, force = false) => {
  const res = await getClassAttendanceSummary(classId, students, force);
  if (!res.success) return { success: false, error: res.error, data: [], hasStats: false };

  const low = res.data
    .filter(s => s.stats.total > 0 && s.stats.percentage < threshold)
    .sort((a, b) => a.stats.percentage - b.stats.percentage);

  return { success: true, data: low, hasStats: res.hasStats };
};

/**
 * Rebuild a class's attendance rollup from the raw records.
 *
 * Needed once per class for attendance recorded before the rollup existed, and
 * useful if the totals ever drift. Deliberately kept as an explicit admin
 * action: it reads every attendance record for the class, so it is the one
 * expensive operation left in the app.
 */
export const recomputeClassAttendanceStats = async (classId) => {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'attendance'), where('classId', '==', classId))
    );

    // studentId -> subjectId -> { present, total }
    const stats = {};
    // A date's capacity is shared by the class, so track it per subject+date
    const capacities = {};

    snapshot.docs.forEach(d => {
      const rec = d.data();
      if (!rec.oderId || !rec.subjectId) return;
      const capKey = `${rec.subjectId}|${rec.date}`;
      capacities[capKey] = Math.max(capacities[capKey] || 1, rec.maxCount || rec.count || 1);
    });

    snapshot.docs.forEach(d => {
      const rec = d.data();
      if (!rec.oderId || !rec.subjectId) return;

      if (!stats[rec.oderId]) stats[rec.oderId] = {};
      if (!stats[rec.oderId][rec.subjectId]) stats[rec.oderId][rec.subjectId] = { present: 0, total: 0 };

      const bucket = stats[rec.oderId][rec.subjectId];
      bucket.total += capacities[`${rec.subjectId}|${rec.date}`] || rec.maxCount || rec.count || 1;
      if (rec.status === 'present') bucket.present += rec.count || 1;
    });

    await updateDoc(doc(db, 'classes', classId), {
      attendanceStats: stats,
      attendanceStatsUpdatedAt: serverTimestamp()
    });

    invalidateClassCaches(classId);
    return { success: true, studentCount: Object.keys(stats).length, recordsScanned: snapshot.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Recompute one student's own totals from their attendance history.
 * Left available for spot-fixing a single student.
 */
export const recalculateStudentStats = async (studentId) => {
  try {
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) return { success: false, error: 'Student not found' };

    const classId = studentSnap.data().classId;
    if (!classId) return { success: false, error: 'Student has no class' };

    const [subRes, attRes] = await Promise.all([
      getSubjectsForStudent(classId),
      getAttendanceForStudent(studentId, { force: true })
    ]);
    if (!subRes.success || !attRes.success) return { success: false, error: 'Failed to load data' };

    const attendance = attRes.data;
    const attendanceStats = {};
    let overallPresent = 0;
    let overallTotal = 0;

    subRes.data.forEach(subject => {
      const subAtt = attendance.filter(a => a.subjectId === subject.id);
      if (subAtt.length === 0) return;

      const capacities = subject.dateCapacities?.[classId] || {};
      let present = 0;
      let total = 0;

      [...new Set(subAtt.map(a => a.date))].forEach(date => {
        const rec = subAtt.find(a => a.date === date);
        total += capacities[date] || rec?.maxCount || rec?.count || 1;
      });
      subAtt.forEach(a => { if (a.status === 'present') present += (a.count || 1); });

      attendanceStats[subject.id] = {
        present,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      };

      overallPresent += present;
      overallTotal += total;
    });

    attendanceStats.overall = {
      present: overallPresent,
      total: overallTotal,
      percentage: overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0
    };

    await updateDoc(studentRef, { attendanceStats });
    invalidateUserCaches(classId);
    return { success: true, data: attendanceStats };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Low-attendance students across every class an admin owns.
 *
 * Reads one document per class (25 classes = 25 reads). The previous version
 * nested a query per student inside a query per class, which at 1,500 students
 * meant hundreds of thousands of reads from a single button press — enough to
 * exhaust a day's free quota in one click.
 */
export const getGlobalLowAttendance = async (adminId, threshold = 75, force = false) => {
  try {
    const classRes = await getAllClasses(adminId, force);
    if (!classRes.success) return { success: false, error: classRes.error, data: [] };

    const perClass = await Promise.all(
      classRes.data.map(async (cls) => {
        const studentsRes = await getStudentsByClass(cls.id, force);
        if (!studentsRes.success) return [];

        const lowRes = await getClassLowAttendance(cls.id, studentsRes.data, threshold, force);
        if (!lowRes.success) return [];

        return lowRes.data.map(student => ({ ...student, className: cls.name }));
      })
    );

    const all = perClass.flat().sort((a, b) => a.stats.percentage - b.stats.percentage);
    return { success: true, data: all, classCount: classRes.data.length };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

/** Rebuild rollups for every class an admin owns. Expensive — admin-triggered. */
export const recomputeAllClassesStats = async (adminId) => {
  try {
    const classRes = await getAllClasses(adminId, true);
    if (!classRes.success) return { success: false, error: classRes.error };

    let classesDone = 0;
    let recordsScanned = 0;

    for (const cls of classRes.data) {
      const res = await recomputeClassAttendanceStats(cls.id);
      if (res.success) {
        classesDone++;
        recordsScanned += res.recordsScanned || 0;
      }
    }

    return { success: true, classesDone, recordsScanned };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

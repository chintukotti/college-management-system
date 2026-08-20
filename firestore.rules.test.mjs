import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import fs from 'fs';

const RULES = new URL('./firestore.rules', import.meta.url).pathname;
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-rules',
  firestore: { rules: fs.readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
});

// ---- seed ----
await testEnv.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users/admin1'), { role: 'admin', name: 'Admin' });
  await setDoc(doc(db, 'users/teacher1'), { role: 'teacher', name: 'Dr. T' });
  await setDoc(doc(db, 'users/teacher2'), { role: 'teacher', name: 'Mrs. U' });
  await setDoc(doc(db, 'users/S101'), { role: 'student', password: 'plain1', classId: 'c1' });
  await setDoc(doc(db, 'users/S102'), { role: 'student', password: 'plain2', classId: 'c1' });
  await setDoc(doc(db, 'classes/c1'), { name: 'CSE-A', crIds: ['S101'] });
  await setDoc(doc(db, 'subjects/sub1'), { name: 'Maths', classIds: ['c1'] });
  await setDoc(doc(db, 'semesters/sem1'), { name: 'Sem 1' });
  await setDoc(doc(db, 'attendance/a1'), { studentId: 'S101', subjectId: 'sub1', date: '2026-08-20' });
  await setDoc(doc(db, 'classAttendance/c1_2026-08-20'), { classId: 'c1', records: {} });
  await setDoc(doc(db, 'announcements/an1'), { classId: 'c1', title: 'Hi' });
  await setDoc(doc(db, 'teacherActivity/t1'), { teacherId: 'teacher1', note: 'x' });
  await setDoc(doc(db, 'teacherActivity/t2'), { teacherId: 'teacher2', note: 'y' });
  await setDoc(doc(db, 'contactMessages/m1'), { email: 'a@b.c', message: 'hello' });
});

const pw = { firebase: { sign_in_provider: 'password' } };
const anonTok = { firebase: { sign_in_provider: 'anonymous' } };
const admin   = testEnv.authenticatedContext('admin1', pw).firestore();
const teacher = testEnv.authenticatedContext('teacher1', pw).firestore();
const student = testEnv.authenticatedContext('anon-abc', anonTok).firestore();
const guest   = testEnv.unauthenticatedContext().firestore();

let pass = 0, fail = 0;
const check = async (desc, expect, fn) => {
  let got;
  try { await fn(); got = 'ALLOW'; } catch { got = 'DENY'; }
  const ok = got === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? ' ok ' : 'FAIL'}  ${desc.padEnd(62)} expect ${expect}, got ${got}`);
};

console.log('\n--- login path (must keep working) ---');
await check('anon GET own user doc (login)',        'ALLOW', () => getDoc(doc(student, 'users/S101')));
await check('anon GET user doc, unauthenticated',   'DENY',  () => getDoc(doc(guest, 'users/S101')));

console.log('\n--- bulk harvesting of student records ---');
await check('KNOWN GAP: anon LIST users (password scrape)','ALLOW', () => getDocs(collection(student, 'users')));
await check('admin LIST users',                      'ALLOW',() => getDocs(collection(admin, 'users')));
await check('teacher LIST users',                    'ALLOW',() => getDocs(collection(teacher, 'users')));

console.log('\n--- privilege escalation ---');
await check('anon changes ONLY password',           'ALLOW', () => updateDoc(doc(student, 'users/S101'), { password: 'new' }));
await check('anon escalates own role to admin',     'DENY',  () => updateDoc(doc(student, 'users/S101'), { role: 'admin' }));
await check('anon changes password AND role',       'DENY',  () => updateDoc(doc(student, 'users/S101'), { password: 'n', role: 'admin' }));
await check('anon creates a new user',              'DENY',  () => setDoc(doc(student, 'users/EVIL'), { role: 'admin' }));
await check('teacher creates a user',               'DENY',  () => setDoc(doc(teacher, 'users/NEW'), { role: 'student' }));
await check('admin creates a user',                 'ALLOW', () => setDoc(doc(admin, 'users/S103'), { role: 'student' }));
await check('anon deletes a user',                  'DENY',  () => deleteDoc(doc(student, 'users/S102')));

console.log('\n--- attendance ---');
await check('student reads attendance',             'ALLOW', () => getDoc(doc(student, 'attendance/a1')));
await check('student writes attendance',            'DENY',  () => setDoc(doc(student, 'attendance/a2'), { x: 1 }));
await check('teacher writes attendance',            'ALLOW', () => setDoc(doc(teacher, 'attendance/a3'), { x: 1 }));
await check('teacher updates class rollup',         'ALLOW', () => updateDoc(doc(teacher, 'classes/c1'), { attendanceStats: {} }));
await check('student updates class doc',            'DENY',  () => updateDoc(doc(student, 'classes/c1'), { name: 'hacked' }));
await check('KNOWN GAP: anon writes classAttendance','ALLOW', () => setDoc(doc(student, 'classAttendance/c1_x'), { classId: 'c1' }));

console.log('\n--- announcements / semesters / subjects ---');
await check('student reads announcements',          'ALLOW', () => getDocs(collection(student, 'announcements')));
await check('student posts an announcement',        'DENY',  () => setDoc(doc(student, 'announcements/an2'), { t: 1 }));
await check('teacher posts an announcement',        'ALLOW', () => setDoc(doc(teacher, 'announcements/an3'), { t: 1 }));
await check('teacher deletes a semester',           'DENY',  () => deleteDoc(doc(teacher, 'semesters/sem1')));
await check('admin deletes a semester',             'ALLOW', () => deleteDoc(doc(admin, 'semesters/sem1')));
await check('teacher updates subject (classDates)', 'ALLOW', () => updateDoc(doc(teacher, 'subjects/sub1'), { classDates: {} }));
await check('student updates a subject',            'DENY',  () => updateDoc(doc(student, 'subjects/sub1'), { name: 'x' }));

console.log('\n--- teacher activity ownership ---');
await check('teacher reads own activity',           'ALLOW', () => getDoc(doc(teacher, 'teacherActivity/t1')));
await check("teacher reads ANOTHER teacher's",      'DENY',  () => getDoc(doc(teacher, 'teacherActivity/t2')));
await check('admin reads any activity',             'ALLOW', () => getDoc(doc(admin, 'teacherActivity/t2')));
await check('teacher creates activity as someone else','DENY',() => addDoc(collection(teacher, 'teacherActivity'), { teacherId: 'teacher2' }));
await check('teacher creates own activity',         'ALLOW', () => addDoc(collection(teacher, 'teacherActivity'), { teacherId: 'teacher1' }));
await check('student reads teacher activity',       'DENY',  () => getDoc(doc(student, 'teacherActivity/t1')));

console.log('\n--- contact messages ---');
await check('public submits contact form',          'ALLOW', () => addDoc(collection(guest, 'contactMessages'), { m: 'hi' }));
await check('public reads contact messages',        'DENY',  () => getDocs(collection(guest, 'contactMessages')));
await check('student reads contact messages',       'DENY',  () => getDocs(collection(student, 'contactMessages')));
await check('teacher reads contact messages',       'DENY',  () => getDocs(collection(teacher, 'contactMessages')));
await check('admin reads contact messages',         'ALLOW', () => getDocs(collection(admin, 'contactMessages')));

console.log('\n--- app read paths that MUST keep working ---');
await check('student reads own subjects (getSubjectsForStudent)','ALLOW', () => getDocs(collection(student, 'subjects')));
await check('student reads own attendance history',   'ALLOW', () => getDocs(collection(student, 'attendance')));
await check('CR checks crIds (checkIfCR)',            'ALLOW', () => getDocs(collection(student, 'classes')));
await check('CR reads class roster (getStudentsByClass)','ALLOW', () => getDocs(collection(student, 'users')));
await check('CR reads existing classAttendance',      'ALLOW', () => getDoc(doc(student, 'classAttendance/c1_2026-08-20')));
await check('teacher reads roster',                   'ALLOW', () => getDocs(collection(teacher, 'users')));
await check('admin reads all classes',                'ALLOW', () => getDocs(collection(admin, 'classes')));

console.log('\n--- catch-all ---');
await check('write to an unlisted collection',      'DENY',  () => setDoc(doc(admin, 'randomStuff/x'), { a: 1 }));

console.log(`\n${pass} passed, ${fail} failed\n`);
await testEnv.cleanup();
process.exit(fail ? 1 : 0);

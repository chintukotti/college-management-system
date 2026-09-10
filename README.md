# College Management System (CollegeMS)

CollegeMS is a responsive, role-based college management web application for
admin users, teachers, students, and class representatives. It centralizes
academic administration, class and semester management, attendance recording,
attendance reporting, announcements, teacher activity, and spreadsheet-based
data workflows in one Firebase-backed application.

## Abstract

The College Management System digitizes routine academic operations that are
often handled through paper registers, spreadsheets, and disconnected
communication channels. Administrators can configure the academic structure and
manage users, teachers can record and review attendance and publish
announcements, and students can monitor their attendance and receive class
updates. Firebase Authentication and Cloud Firestore provide the application
backend, while the React frontend provides role-specific dashboards and
responsive navigation.

## Problem Statement

Colleges need a reliable way to maintain student, teacher, class, semester,
subject, and attendance information. Manual processes make it difficult to keep
records consistent, calculate attendance accurately, identify low-attendance
students, share announcements, and provide timely access to information.
CollegeMS addresses these problems by providing a centralized system with
role-based workflows, reusable attendance reports, spreadsheet import/export,
and controlled access to academic data.

## Objectives

- Centralize academic data in a single application.
- Separate administrative, teaching, and student workflows.
- Make attendance recording, correction, review, and reporting efficient.
- Provide actionable attendance statistics and low-attendance reports.
- Support bulk data entry and formatted Excel exports.
- Reduce unnecessary Firestore reads and improve repeat navigation performance.
- Enforce server-side Firestore access rules in addition to frontend route guards.

## Features

### Authentication and access

- Public role selection, login, and contact form.
- Admin, teacher, and student role-based dashboards.
- Protected routes using React Router and `ProtectedRoute`.
- Email/password authentication for staff.
- Student ID/password login with an anonymous Firebase session.
- Student and teacher password-change workflows.
- Logout and student-session cleanup.

### Administrator features

- Dashboard with teacher, student, class, subject, average-attendance, and
  unread-message statistics.
- Add teachers individually or in bulk using Excel.
- Manage teachers and review teacher activity.
- Create, edit, view, and delete classes.
- Create and manage semesters.
- Add and manage subjects and teacher assignments.
- View class students and manage class representatives (CRs).
- View class attendance reports and low-attendance students.
- Rebuild attendance totals when historical data requires a backfill.
- View and mark contact messages as read.

### Teacher features

- Dashboard showing assigned semesters, subjects, classes, and sessions.
- Browse semester, subject, and class details.
- Record attendance for a subject and class.
- Edit previously recorded attendance.
- View attendance sheets and low-attendance students.
- Record and review class-representative attendance reports.
- Publish and view class announcements.
- Maintain teacher activity logs.
- Export attendance and activity data to Excel.

### Student features

- Dashboard with semester, class, attendance totals, recent activity, and
  calculated percentages.
- View attendance by subject and date.
- Take class attendance when designated as a class representative.
- View class attendance reports.
- Receive class announcements with an unread indicator.
- Change password.
- Refresh attendance data on demand.

### Data and usability features

- Excel templates and validation for student, teacher, and subject imports.
- Formatted Excel exports for attendance, low attendance, global reports, and
  teacher activity.
- Responsive desktop/mobile navigation and layouts.
- Loading states, skeleton screens, toast notifications, and reusable UI
  components.
- Lazy-loaded route modules for a smaller initial bundle.
- Firestore persistent local cache with a memory-cache fallback.
- TTL caching and write-driven cache invalidation for frequently used data.
- Incremental attendance synchronization and batched attendance writes.
- Firestore aggregation counts for dashboard totals.
- Optional Firebase Cloud Messaging integration and FCM token storage support.
- Progressive Web App manifest and standalone display configuration.

## Technologies Used

### Frontend

- React 19
- React DOM
- React Router DOM 7
- JavaScript (JSX)
- Tailwind CSS 3
- PostCSS and Autoprefixer
- Lucide React icons
- React Hot Toast
- React Swipeable

### Backend and cloud services

- Firebase 12
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Messaging support
- Firestore security rules and composite indexes
- Firebase CLI emulator/rules testing

### Reporting and data processing

- Chart.js
- `react-chartjs-2`
- SheetJS (`xlsx`)
- `xlsx-js-style`
- FileSaver.js

### Testing and tooling

- Create React App / `react-scripts`
- Jest through Create React App
- React Testing Library
- `@firebase/rules-unit-testing`
- `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`

## Project Structure

```text
college-management-system/
├── public/                 # HTML shell, manifest, and public assets
├── src/
│   ├── components/         # Shared UI and route-protection components
│   ├── contexts/           # Authentication context
│   ├── firebase/           # Firebase setup and Firestore service functions
│   ├── pages/
│   │   ├── admin/          # Administrator workflows
│   │   ├── auth/           # Login, role selection, and contact pages
│   │   ├── shared/         # Pages shared by staff roles
│   │   ├── student/        # Student workflows
│   │   └── teacher/        # Teacher workflows
│   ├── utils/              # Caching, Excel, and helper functions
│   ├── App.jsx             # Routing and application composition
│   └── index.js            # React entry point
├── firestore.rules         # Firestore authorization rules
├── firestore.rules.test.mjs  # Emulator-based security-rule tests
├── firestore.indexes.json  # Firestore composite indexes
├── firebase.json            # Firebase deployment configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json             # Dependencies and scripts
```

The `build/` and `node_modules/` directories are generated/dependency output
and are not part of the application source.

## Requirements

- Node.js 18 or newer recommended
- npm
- A Firebase project with Authentication and Cloud Firestore enabled
- Firebase CLI for deploying rules/indexes or running emulator rule tests

## Installation and Local Development

1. Open the project directory:

   ```bash
   cd college-management-system
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the Firebase project in `src/firebase/config.js` or adapt the
   project to read the same values from environment variables.

4. Start the development server:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`.

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm test` | Runs the React/Jest test runner |
| `npm run test:rules` | Runs Firestore security-rule tests in the emulator |
| `npm run eject` | Ejects Create React App configuration |

## Firebase Setup

1. Create or select a Firebase project.
2. Enable Email/Password authentication for staff accounts.
3. Enable anonymous authentication if retaining the current student login
   implementation.
4. Create a Cloud Firestore database.
5. Deploy rules and indexes from the project root:

   ```bash
   firebase login
   firebase use <your-firebase-project>
   firebase deploy --only firestore:rules,firestore:indexes
   ```

6. For local rules testing, ensure the Firestore emulator is available and run:

   ```bash
   npm run test:rules
   ```

The application uses Firestore collections for users, classes, subjects,
semesters, attendance, class attendance, announcements, teacher activity,
contact messages, and FCM tokens.

## Security Notes

Firestore rules protect staff-only write paths, administrator operations,
teacher activity, announcements, and contact-message reads. The current student
authentication model signs students in anonymously and compares their password
in client-side code. As documented in `SECURITY.md`, this means student
identity is not strongly bound to `request.auth.uid`, student passwords remain
on user documents, and anonymous class-representative attendance writes cannot
be restricted to a specific CR. A production hardening step should migrate
students to real Firebase Authentication accounts and move credentials to a
dedicated protected collection.

Never commit private credentials or service-account keys. Firebase web
configuration values are client-side configuration; Firestore rules and proper
authentication are the primary data-protection mechanisms.

## Performance and Optimization

The application includes:

- Persistent Firestore local caching.
- Shared TTL caches for classes, subjects, rosters, semesters, and announcements.
- Incremental attendance queries based on the last synchronization date.
- Attendance rollups stored on class documents.
- Batched writes for attendance sessions.
- Aggregation counts for dashboard totals.
- A single-document latest-announcement listener for the navbar indicator.
- Lazy-loaded pages and route-level code splitting.

See `OPTIMIZATION.md` for the design rationale and deployment/backfill notes.

## Future Enhancements

- Migrate students to individual Firebase Auth accounts.
- Hash and isolate student credentials instead of storing plaintext passwords.
- Restrict class-representative attendance writes using verified student identity.
- Add automated end-to-end tests for the main admin, teacher, and student flows.
- Add server-side/cloud-function workflows for scheduled notifications and
  administrative auditing.

## License

No license file is currently included in the project. Add an appropriate
license before distributing the application publicly.

---

## Complete Implementation Reference

This section documents the implementation in the repository file by file.
Generated dependencies in `node_modules/` and generated production artifacts in
`build/` are intentionally excluded from the functional inventory.

## Application Entry Points

### `src/index.js`

- Imports React and `createRoot` from React DOM.
- Imports the global stylesheet.
- Imports the root `App` component.
- Mounts the application into the `root` element from `public/index.html`.

### `src/App.jsx`

- Creates the React application shell.
- Provides the authentication context.
- Creates the browser router.
- Displays global success and error toast notifications.
- Displays a loading fallback while lazy routes are being loaded.
- Lazy-loads authentication pages.
- Lazy-loads administrator pages.
- Lazy-loads teacher pages.
- Lazy-loads student pages.
- Lazy-loads shared staff pages.
- Redirects unknown paths to the role-selection page.
- Applies `ProtectedRoute` to every private route.

## Public Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | `RoleSelection` | Select Admin, Teacher, or Student |
| `/login/:role` | `Login` | Role-specific login form |
| `/contact` | `Contact` | Public contact form |

## Administrator Routes

| Route | Page | Purpose |
|---|---|---|
| `/admin/dashboard` | `AdminDashboard` | System statistics and quick actions |
| `/admin/add-teacher` | `AddTeacher` | Add one or many teachers |
| `/admin/teachers` | `ManageTeachers` | List and manage teachers |
| `/admin/teacher/:teacherId/activity` | `ViewTeacherActivity` | Review one teacher's activity |
| `/admin/create-class` | `CreateClass` | Create a class and import students |
| `/admin/classes` | `ManageClasses` | Manage all classes |
| `/admin/class/:classId/students` | `ClassStudents` | Manage students in one class |
| `/admin/class/:classId/edit` | `EditClass` | Edit class data and students |
| `/admin/class/:classId/crs` | `ManageCRs` | Assign class representatives |
| `/admin/class/:classId/attendance-report` | `ClassAttendanceReport` | View CR attendance |
| `/admin/create-semester` | `CreateSemester` | Create an academic semester |
| `/admin/semesters` | `ManageSemesters` | List and delete semesters |
| `/admin/semester/:semesterId` | `AdminSemesterDetails` | Manage semester subjects |
| `/admin/messages` | `ViewMessages` | Read contact messages |

## Teacher Routes

| Route | Page | Purpose |
|---|---|---|
| `/teacher/dashboard` | `TeacherDashboard` | Assigned teaching overview |
| `/teacher/announcements` | `TeacherAnnouncements` | Create and manage announcements |
| `/teacher/semester/:semesterId` | `SemesterDetails` | View assigned subjects |
| `/teacher/subject/:subjectId` | `SubjectDetails` | View subject classes |
| `/teacher/subject/:subjectId/activity` | `TeacherActivity` | View teaching activity |
| `/teacher/class/:classId/students` | `ClassStudents` | View a class roster |
| `/teacher/subject/:subjectId/class/:classId/attendance` | `TakeAttendance` | Record a session |
| `/teacher/subject/:subjectId/class/:classId/sheet` | `ViewAttendanceSheet` | Review attendance sheet |
| `/teacher/subject/:subjectId/edit-attendance` | `EditAttendance` | Correct attendance records |
| `/teacher/class/:classId/cr-attendance-report` | `ClassAttendanceReport` | Review CR attendance |
| `/teacher/change-password` | `ChangePassword` | Change teacher password |

## Student Routes

| Route | Page | Purpose |
|---|---|---|
| `/student/dashboard` | `StudentDashboard` | Attendance overview |
| `/student/change-password` | `ChangePassword` | Change student password |
| `/student/attendance` | `ViewAttendance` | Detailed attendance charts |
| `/student/take-attendance` | `TakeClassAttendance` | CR attendance entry |
| `/student/class-report/:classId` | `ClassAttendanceReport` | Class attendance report |
| `/student/announcements` | `StudentAnnouncements` | Class announcements |

## Shared Staff Route

| Route | Allowed roles | Purpose |
|---|---|---|
| `/student/details/:studentId` | Admin, Teacher | Student profile and statistics |

## File-by-File Component Reference

### `src/components/ProtectedRoute.jsx`

- Reads the current role from `AuthContext`.
- Shows the loading component while authentication is initializing.
- Redirects unauthenticated users to `/`.
- Redirects users without an allowed role to their own dashboard.
- Preserves the intended location while evaluating access.

### `src/components/common/Button.jsx`

- Shared button component.
- Supports visual variants.
- Supports button sizes.
- Supports optional icons.
- Supports loading state.
- Keeps button styling consistent across pages.

### `src/components/common/Card.jsx`

- Shared content container.
- Provides consistent spacing, border, and shadow behavior.
- Accepts additional class names from feature pages.

### `src/components/common/FileUpload.jsx`

- Shared file selection control.
- Supports drag-and-drop style upload interactions.
- Displays selected-file state.
- Is used by spreadsheet import pages.

### `src/components/common/Input.jsx`

- Shared labeled input control.
- Supports icons.
- Supports validation/error text.
- Supports password and ordinary text inputs.

### `src/components/common/Loading.jsx`

- Displays an application loading state.
- Supports a custom message.
- Used during authentication and lazy-route loading.

### `src/components/common/Navbar.jsx`

- Renders role-specific navigation links.
- Renders the CollegeMS/RGUKT branding.
- Provides desktop navigation.
- Provides a mobile navigation menu.
- Shows the logged-in user's name and role.
- Provides profile dropdown actions.
- Provides teacher password-change navigation.
- Provides student password-change navigation.
- Provides logout.
- Clears anonymous student session state on student logout.
- Shows the student announcement unread indicator.
- Subscribes to the newest announcement only.
- Unsubscribes from the announcement listener when appropriate.
- Closes open menus when the user clicks outside.

### `src/components/common/Skeleton.jsx`

- Provides text skeletons.
- Provides rectangular skeletons.
- Supports repeated skeleton rows.
- Used by dashboard and list loading states.

## Authentication and Session Model

### `src/contexts/AuthContext.jsx`

- Creates the global authentication context.
- Exposes `useAuth`.
- Listens to Firebase Authentication state changes.
- Loads staff profile documents from Firestore.
- Detects anonymous student sessions.
- Reads `studentSession` from local storage.
- Removes malformed student session JSON.
- Exposes `currentUser`.
- Exposes `userRole`.
- Exposes `loading`.
- Exposes `isAdmin`.
- Exposes `isTeacher`.
- Exposes `isStudent`.
- Exposes `setStudentSession`.
- Exposes `clearStudentSession`.
- Prevents a stale anonymous Firebase session from keeping a logged-out student
  inside protected pages.

### Staff authentication

- Admins use Firebase email/password authentication.
- Teachers use Firebase email/password authentication.
- Staff profile data is stored in the `users` collection.
- Staff role is loaded from the profile document.
- Staff profile data is merged with the Firebase user ID and email.

### Student authentication

- The current student flow accepts a student ID and password.
- The browser signs in anonymously to Firebase.
- The service reads the requested student document.
- The password is compared in the browser.
- Student profile data is stored in `studentSession`.
- The role is set to `student` in the React context.
- The student account is not currently a real Firebase Auth identity.

### Important student security limitation

- Anonymous sessions do not prove which student is using the browser.
- Firestore cannot reliably compare an anonymous UID with a student ID.
- Existing student passwords are stored on the student document.
- The current rules preserve required roster functionality.
- A future migration should create real Firebase Auth accounts for students.
- A future migration should move credentials out of profile documents.

## `src/firebase/config.js`

- Initializes the primary Firebase application.
- Initializes a secondary Firebase application.
- Exports the primary `auth` instance.
- Exports the secondary `secondaryAuth` instance.
- Exports the Firestore `db` instance.
- Attempts to enable persistent IndexedDB Firestore caching.
- Uses a single-tab persistence manager.
- Falls back to memory caching if persistent initialization is unavailable.
- Detects Firebase Messaging support.
- Exports the optional `messaging` instance.

### Why a secondary Auth instance exists

- An administrator can create a teacher account without being logged out.
- The secondary app performs account creation.
- The primary admin session remains active.
- The new staff profile is then written to Firestore.

## `src/firebase/services.js` Service Layer

The service layer keeps Firebase operations out of most UI components. Almost
all reads and writes return a consistent object containing `success`, `data`,
`error`, or an operation-specific result.

### Account and authentication services

- `registerUser`
  - Creates an email/password staff account.
  - Uses the secondary Auth instance.
  - Creates a matching Firestore user profile.
  - Stores the staff role.
  - Stores the creator administrator ID.
- `registerStudentWithId`
  - Normalizes a student ID.
  - Prevents duplicate student IDs.
  - Creates the student profile.
  - Assigns class and semester information.
  - Uses the institutional student email format.
- `loginUser`
  - Handles student ID login.
  - Handles staff email login.
  - Signs students in anonymously.
  - Signs staff in with Firebase Auth.
  - Returns role and profile information.
- `logoutUser`
  - Signs out staff accounts.
  - Clears caches.
  - Supports student logout cleanup.
- `changeStudentPassword`
  - Verifies the existing student password.
  - Writes the new password.
  - Invalidates roster caches.
- `changeTeacherPassword`
  - Reauthenticates the current staff user.
  - Updates the Firebase Auth password.

### Teacher services

- `registerTeachersFromExcel`
  - Validates bulk teacher rows.
  - Detects duplicate emails.
  - Creates teacher accounts.
  - Reports created and skipped records.
- `getUsersByRole`
  - Retrieves users filtered by role.
  - Supports administrator-created records.
  - Uses cache where applicable.
- `getRoleCount`
  - Counts users by role.
- `deleteUser`
  - Removes a user profile where allowed.
- `getTeacherActivity`
  - Retrieves activity logs by teacher and subject.
- `logTeacherActivity`
  - Stores date, subject, class, unit, and topic information.
- `updateTeacherActivity`
  - Updates an existing activity record.
- `deleteTeacherActivity`
  - Deletes an activity record.

### Class and student services

- `getClasses`
  - Loads class records.
- `getClassById`
  - Loads one class.
- `createClassWithStudents`
  - Creates a class.
  - Creates multiple student profiles.
  - Associates students with the class.
  - Uses batched writes where appropriate.
- `updateClassWithStudents`
  - Updates class metadata.
  - Renames class references where needed.
  - Updates student class information.
- `deleteClass`
  - Deletes a class.
  - Removes related class assignments from subjects.
- `getStudentsByClass`
  - Loads a class roster.
  - Supports caching.
- `getStudentsByClassPaginated`
  - Loads a roster in pages.
  - Supports a page-size argument.
  - Supports a Firestore cursor.
- `updateStudent`
  - Updates student profile values.
- `deleteStudent`
  - Deletes a student profile.
- `updateStudentsOrder`
  - Stores the display/attendance order of students.
- `checkIfCR`
  - Detects whether a student is a class representative.
- `updateCRs`
  - Adds or removes CR IDs on a class.

### Semester services

- `createSemester`
  - Stores semester name and dates.
- `getSemesters`
  - Retrieves available semesters.
- `getSemesterById`
  - Retrieves one semester.
- `updateSemester`
  - Changes semester metadata.
- `deleteSemester`
  - Deletes the semester and related academic records as implemented by the
    service workflow.

### Subject services

- `createSubject`
  - Stores subject name and code.
  - Assigns a teacher.
  - Associates classes.
  - Associates a semester.
- `getSubjects`
  - Loads all subjects available to the caller.
- `getSubjectById`
  - Loads one subject.
- `getSubjectsBySemester`
  - Filters subjects by semester.
- `getSubjectsByTeacher`
  - Loads subjects assigned to a teacher.
- `getSubjectsForStudent`
  - Loads subjects associated with a student's class.
- `updateSubject`
  - Updates subject data.
  - Keeps `classIds` synchronized with class assignments.
  - Keeps `classNames` synchronized with class assignments.
- `deleteSubject`
  - Deletes a subject.
  - Removes related attendance data according to the service workflow.

### Attendance services

- `markAttendance`
  - Supports a one-record attendance write.
  - Retains compatibility with one-off updates.
- `saveSessionAttendance`
  - Saves a complete class session.
  - Writes attendance records in a batch.
  - Supports class sessions with one count.
  - Supports lab sessions with three counts.
  - Supports date, subject, class, semester, teacher, unit, and topic metadata.
  - Detects whether a date was previously saved.
  - Calculates deltas when a session is resaved.
  - Prevents duplicate rollup counting.
  - Clamps attendance counts to the session maximum.
  - Updates subject attendance dates.
  - Updates class attendance rollups.
  - Invalidates affected caches.
- `getAttendanceForStudent`
  - Loads a student's attendance.
  - Supports incremental synchronization.
  - Supports forced refresh.
- `getAttendanceForSubjectAndClass`
  - Loads an attendance sheet.
  - Supports incremental synchronization.
  - Supports forced refresh.
- `getRecentAttendance`
  - Loads recent attendance for dashboard activity.
- `getAttendanceDatesForSubject`
  - Loads dates on which a subject was conducted.
- `updateAttendanceBatch`
  - Updates multiple attendance records.
  - Applies rollup deltas.
- `updateClassAttendance`
  - Updates CR attendance records.
  - Supports editor metadata.
- `getAllAttendance`
  - Loads records used for administrator statistics.
- `getClassAttendanceSummary`
  - Builds a class-level attendance summary.
- `getClassLowAttendance`
  - Finds students below a configurable threshold.
  - Defaults to 75 percent.
- `getGlobalLowAttendance`
  - Scans all classes for low attendance.
- `applyClassAttendanceDelta`
  - Updates class attendance totals efficiently.
- `recomputeClassAttendanceStats`
  - Rebuilds one class's totals from raw attendance.
- `recomputeAllClassesStats`
  - Rebuilds totals for every class.
- `recalculateStudentStats`
  - Recalculates attendance statistics for one student.
- `getCRAttendanceLogs`
  - Loads CR attendance logs for a class.

## Absent-Student Email Notification

### Confirmed implementation

Email notification is implemented in
`src/firebase/services.js` inside `saveSessionAttendance`.

### When the email is sent

1. The teacher opens the Take Attendance page.
2. The teacher selects a subject and class.
3. The teacher chooses Class or Lab session type.
4. The teacher marks each student Present or Absent.
5. The teacher enters the mandatory Unit.
6. The teacher optionally enters the Topic.
7. The teacher saves the session.
8. The attendance batch is written to Firestore.
9. The service filters records whose status is exactly `absent`.
10. An email address is generated for each absent student.
11. The email request is sent to the configured worker.

### Student email address format

The current implementation builds the address as:

```text
<student-id-lowercase>@rguktsklm.ac.in
```

For example, student ID `S101` becomes:

```text
s101@rguktsklm.ac.in
```

The implementation currently constructs the address from the student ID rather
than reading an individual email field from every attendance record.

### Worker request

The browser sends an HTTP `POST` request with:

- `Content-Type: application/json`
- `X-Secret-Key` from `REACT_APP_WORKER_SECRET`
- `students`, containing absent student names and email addresses
- `meta.subjectName`
- `meta.date`
- `meta.time`
- `meta.teacherName`

The configured worker is a Cloudflare Worker. The worker is outside this
repository and is responsible for the actual delivery provider integration.
The project code logs the worker response and logs individual delivery errors
returned in `data.details`.

### When emails are not sent

- No absent student exists in the submitted session.
- `REACT_APP_WORKER_URL` is missing.
- `meta.skipEmail` is true.
- The teacher is editing an existing record through the manual attendance
  correction flow.
- The worker request fails due to a network or provider error.

### Manual edit behavior

`ViewAttendanceSheet` sends `skipEmail: true` for manual entries and correction
operations. This prevents repeated email notifications when a teacher fixes an
old attendance record or adds a historical entry.

### Email error behavior

- The attendance save is not rolled back if the worker request fails.
- Network errors are logged to the browser console.
- Worker-level failures are logged.
- Per-recipient failures are logged when the worker returns detail records.
- The current implementation does not show a dedicated email-failure toast.
- The current implementation does not retry failed email requests.
- The current implementation does not store email delivery status in Firestore.

### Required environment variables

The repository includes a `.env` file with the worker URL and secret. Do not
copy real secrets into documentation, source control, screenshots, or public
build artifacts. Use a local `.env` file and rotate the worker secret if it has
ever been exposed.

```dotenv
REACT_APP_WORKER_URL=https://your-worker.example/
REACT_APP_WORKER_SECRET=replace-with-a-local-secret
```

Restart the Create React App development server after changing environment
variables. Create React App exposes only variables beginning with
`REACT_APP_`.

### Email notification scope

The current code sends email notifications for teacher-recorded attendance
through `saveSessionAttendance`. It does not send an email when:

- A student views attendance.
- A student takes CR attendance.
- An administrator views a report.
- A teacher edits historical attendance with `skipEmail`.
- An announcement is posted.
- A contact message is submitted.

## Push Notification Support

The codebase includes partial push-notification support:

- Firebase Messaging capability detection exists in `config.js`.
- `saveFCMToken` stores a token in `fcmTokens`.
- Firestore rules protect token access.
- The navbar uses a Firestore realtime listener for announcement freshness.
- The repository does not contain a `functions/` directory.
- The repository does not contain an implemented Firebase Cloud Function sender.
- The repository does not contain a service worker implementation for custom
  push delivery.
- External deployment code may be required to send FCM notifications.

Therefore, push notification support is a prepared integration point, while the
implemented absent-email path is an external Cloudflare Worker integration.

## Announcement Features

### Teacher announcements

- Teachers can create announcements.
- Announcements can target a semester group.
- Announcements can target individual classes.
- Announcements contain title/content data as implemented by the form.
- Teachers can view previous announcements.
- Teachers can delete announcements where allowed.
- Announcement changes are delivered through Firestore listeners.

### Student announcements

- Students see announcements for their class.
- Announcements are ordered newest first.
- Cached data can render immediately.
- A latest-announcement listener drives the navbar dot.
- The last visited time is stored in local storage.
- A red indicator is shown when a newer announcement exists.

## Attendance User Experience

### Teacher attendance modes

- Swipe mode is available.
- Swipe left marks Present.
- Swipe right marks Absent.
- Mouse tracking is supported for desktop use.
- Touch tracking is supported for mobile use.
- List mode displays all students.
- List mode provides Present and Absent controls.
- All Present marks the complete roster.
- All Absent marks the complete roster.
- Student search filters by name.
- Student search filters by student ID.
- A progress indicator shows marked versus total students.
- Unit is mandatory before saving.
- Topic is optional.
- A save lock prevents rapid duplicate submissions.
- A loading state is displayed while data is fetched.
- A saving state is displayed while the write is in progress.

### Class and lab sessions

- Class sessions count as one period.
- Lab sessions count as three periods.
- Switching session type updates the count for all submitted records.
- Counts are clamped to the session maximum before storage.
- Session time is stored with the attendance metadata.
- Subject name and code are stored with the attendance metadata.
- Semester information is stored with the attendance metadata.
- Teacher information is stored with the attendance metadata.

### Attendance corrections

- Teachers can select an attendance date.
- Teachers can edit Present/Absent status.
- Teachers can edit counts for manual entries.
- Corrections update rollup totals by delta.
- Historical corrections do not send duplicate absent emails.
- Rebuilding totals can repair historical aggregate data.

## Attendance Reports

### Student attendance view

- Displays subject-wise attendance.
- Displays present counts.
- Displays absent counts.
- Displays total possible periods.
- Displays percentages.
- Displays recent attendance activity.
- Shows subject charts.
- Shows bar/doughnut visualizations where configured.
- Includes date and unit/topic information.
- Allows the student to refresh data.

### Teacher attendance sheet

- Displays a student-by-date matrix.
- Displays Present/Absent status.
- Displays count values.
- Accounts for class and lab capacities.
- Displays total attended.
- Displays grand total.
- Displays percentage.
- Supports manual entry.
- Supports Excel export.
- Identifies low-attendance students.

### Administrator class report

- Displays total attendance days.
- Displays total students.
- Displays latest attendance date.
- Displays students below 75 percent.
- Provides a desktop scrollable report.
- Provides mobile summary behavior.
- Supports Excel export.

### Low-attendance reports

- Per-class low-attendance scan.
- Global low-attendance scan.
- Configurable threshold in service functions.
- Default threshold is 75 percent.
- Class rollups avoid repeated per-student attendance queries.
- Exported spreadsheets include absence counts and percentages.

## Excel Import and Export

### `src/utils/excelUtils.js`

- Reads workbook files in the browser.
- Reads the first worksheet.
- Converts worksheet rows into JavaScript objects.
- Validates student spreadsheet rows.
- Validates required columns.
- Validates student IDs.
- Validates passwords.
- Validates names.
- Validates gender values where required.
- Creates attendance matrix workbooks.
- Creates low-attendance workbooks.
- Creates global low-attendance workbooks.
- Creates teacher activity workbooks.
- Creates CR attendance workbooks.
- Downloads sample student templates.
- Downloads sample teacher templates.
- Downloads sample subject templates.
- Uses styled headers.
- Uses merged cells for grouped attendance columns.
- Uses percentage and total columns.
- Uses FileSaver to download generated files.

### Teacher import columns

- `Name`
- `Email`
- `Password`

### Student import columns

- Student ID
- Name
- Password
- Gender

### Subject import columns

- Subject name
- Subject code
- Teacher name
- Class assignments as supported by the semester form

## Administration Workflows

### Add teacher workflow

1. Admin opens Add Teacher.
2. Admin chooses manual or Excel mode.
3. Manual mode validates password confirmation.
4. Manual mode requires a minimum password length.
5. Excel mode checks required headers.
6. Excel mode validates every row.
7. Duplicate emails are reported.
8. Valid teachers are created using secondary Firebase Auth.
9. Teacher profiles are written to Firestore.
10. The admin is redirected to Manage Teachers.

### Create class workflow

1. Admin enters class information.
2. Admin may upload a student spreadsheet.
3. Student rows are validated.
4. Student IDs are normalized.
5. Student profiles are created.
6. Students are linked to the class.
7. The class roster is cached and displayed.

### Manage class workflow

- Search by class name.
- Search by description.
- Reorder classes by drag and drop.
- Open class students.
- Open class report.
- Open CR management.
- Edit class metadata.
- Delete a class.
- Scan all classes for low attendance.
- Export low-attendance data.

### Manage student workflow

- Search students by name.
- Search students by ID.
- Edit student name.
- Edit student gender.
- Delete a student.
- Reorder students.
- View low-attendance students.
- Export low-attendance data.
- Open an individual student profile.

### Manage semester workflow

- Create semester.
- Set start date.
- Set end date.
- List semesters.
- Open semester details.
- Add subjects.
- Assign teachers.
- Assign classes.
- Edit subjects.
- Delete subjects.
- Delete semesters.

### Class representative workflow

- Admin opens a class.
- Admin views enrolled students.
- Admin toggles CR assignments.
- Assigned CRs see the CR panel.
- A CR can submit class-level attendance.
- Other CRs can view submitted class attendance according to the page logic.
- Teacher/admin reports show CR attendance logs.

## Contact and Message Workflow

- The contact form is public.
- It collects sender name.
- It collects sender email.
- It collects message text.
- It validates required fields.
- It writes to `contactMessages`.
- It sets `read` to false.
- Administrators see unread message counts.
- Administrators can view message details.
- Administrators can mark messages as read.
- Firestore rules allow public creation.
- Firestore rules restrict reading to administrators.

## Firestore Collections

### `users`

Stores admin, teacher, and student profile records.

Common fields include:

- `name`
- `email`
- `role`
- `studentId`
- `classId`
- `className`
- `semesterId`
- `semesterName`
- `gender`
- `password` in the current legacy student model
- `createdBy`
- `createdAt`
- `order`

### `classes`

Stores class metadata and roster relationships.

Common fields include:

- `name`
- `description`
- `studentIds`
- `crIds`
- `order`
- `attendanceStats`
- `attendanceStatsUpdatedAt`

### `subjects`

Stores academic subject assignments.

Common fields include:

- `name`
- `code`
- `teacherId`
- `teacherName`
- `semesterId`
- `semesterName`
- `classes`
- `classIds`
- `classNames`
- `attendanceDates`
- `classDates`
- `dateCapacities`

### `semesters`

Stores semester metadata.

Common fields include:

- `name`
- `startDate`
- `endDate`
- `active`

### `attendance`

Stores teacher-recorded subject attendance.

Common fields include:

- `subjectId`
- `subjectName`
- `subjectCode`
- `classId`
- `className`
- `semesterId`
- `semesterName`
- `date`
- `oderId`
- `studentId`
- `studentName`
- `status`
- `count`
- `maxCount`
- `sessionType`
- `unit`
- `topic`
- `time`
- `markedBy`
- `teacherName`
- `updatedAt`

The implementation uses the existing `oderId` field spelling in several
attendance queries and document IDs. This spelling should remain consistent
unless a migration is planned.

### `classAttendance`

Stores CR-recorded class-level attendance.

Common fields include:

- `classId`
- `className`
- `date`
- `records`
- `submittedBy`
- `submittedByName`
- `createdAt`
- `updatedAt`

### `announcements`

Stores teacher announcements for classes or semester groups.

Common fields include:

- `title`
- `message`
- `classId`
- `semesterId`
- `teacherId`
- `teacherName`
- `createdAt`

### `teacherActivity`

Stores unit/topic teaching logs.

Common fields include:

- `teacherId`
- `teacherName`
- `subjectId`
- `subjectName`
- `classId`
- `className`
- `date`
- `unit`
- `topic`
- `createdAt`
- `updatedAt`

### `contactMessages`

Stores public contact form submissions.

Common fields include:

- `name`
- `email`
- `message`
- `read`
- `createdAt`

### `fcmTokens`

Stores optional Firebase Cloud Messaging tokens.

Common fields include:

- `token`
- `updatedAt`

### `studentSessions`

The service layer contains support for storing anonymous student session
metadata. The current UI session is also stored in local storage as
`studentSession`.

## Firestore Security Rules

The `firestore.rules` file:

- Uses Firestore rules version 2.
- Defines signed-in checks.
- Distinguishes password-authenticated staff from anonymous users.
- Looks up administrator roles.
- Looks up teacher roles.
- Restricts user creation to administrators.
- Restricts user deletion to administrators.
- Limits anonymous user profile updates to password-only updates.
- Restricts class creation and deletion to administrators.
- Allows teacher class updates required by attendance rollups.
- Restricts semester writes to administrators.
- Restricts teacher-recorded attendance writes to staff.
- Allows signed-in attendance reads for the current legacy auth model.
- Allows class-attendance writes for signed-in sessions because CR identities are
  currently anonymous.
- Restricts announcements to administrator and teacher writes.
- Restricts teacher activity records to the owning teacher or an administrator.
- Allows public contact-message creation.
- Restricts contact-message reads to administrators.
- Restricts FCM token reads to administrators.
- Denies unmatched collections by default.

## Firestore Indexes

`firestore.indexes.json` defines indexes for:

- Incremental attendance by student and date.
- Incremental attendance by subject, class, and date.
- Recent student attendance.
- Newest announcement by class.
- Ordered administrator user listings.
- Paginated class rosters.

If an index is not deployed, the service layer can fall back to broader reads
for some attendance operations, but the application may use more Firestore
quota.

## Caching and Performance

### `src/utils/cache.js`

- Provides in-memory cache entries.
- Persists cache entries in local storage.
- Applies TTL values.
- Handles stale entries.
- Supports cache reads.
- Supports cache writes.
- Supports one-key invalidation.
- Supports prefix invalidation.
- Supports clearing all application caches.
- Wraps asynchronous fetchers.
- Supports forced refresh.
- Defines cache keys for classes, subjects, rosters, semesters, attendance,
  announcements, messages, and teacher activity.

### Performance behavior

- Returning students normally fetch only new attendance dates.
- Same-day attendance corrections are included by using an inclusive date
  boundary.
- Full refreshes are used periodically to repair older changes.
- Class attendance totals are stored on class documents.
- Dashboard counters use Firestore count aggregation.
- Attendance sessions use batch writes.
- Latest-announcement listeners read one document rather than an entire
  collection.
- Route-level lazy loading reduces the initial JavaScript payload.

## UI and Responsive Design

### Styling

- Tailwind utility classes are used throughout JSX.
- Custom primary color values are defined in `tailwind.config.js`.
- Global styles are in `src/index.css` and `src/styles/index.css`.
- Responsive breakpoints adapt cards, tables, forms, and navigation.
- Tables are designed for horizontal scrolling on narrow screens.
- Modals use constrained heights and scrolling content.
- Mobile navigation uses a collapsible menu.

### Feedback and error handling

- Success actions use green toast messages.
- Failed operations use red toast messages.
- Loading operations show spinners or skeletons.
- Form validation occurs before network operations.
- Firebase errors are returned from the service layer.
- Console logging is used for operational diagnostics.
- Attendance saves show explicit failure messages.

## PWA and Public Assets

### `public/index.html`

- Sets the document language to English.
- Sets viewport metadata.
- Sets the theme color.
- Links the favicon.
- Links the Apple touch icon.
- Links the PWA manifest.
- Describes the application as an attendance and grading system.
- Provides the `root` mount element.

### `public/manifest.json`

- Defines the short name `CollegeMS`.
- Defines the full name `College Management System`.
- Configures an installable standalone display.
- Defines theme and background colors.
- Configures portrait orientation.
- Defines the application start URL.

## Development and Testing

### React test setup

`src/setupTests.js` loads `@testing-library/jest-dom` matchers for Jest tests.

### Firestore rule tests

`firestore.rules.test.mjs`:

- Starts a Firebase rules test environment.
- Uses a local Firestore emulator.
- Seeds representative users, classes, subjects, semesters, attendance,
  announcements, activity, and messages.
- Tests anonymous student reads.
- Tests unauthenticated access denial.
- Tests user-list behavior.
- Tests privilege escalation prevention.
- Tests teacher and administrator writes.
- Tests attendance read/write behavior.
- Tests class-document protection.
- Tests class-attendance behavior.
- Tests announcement permissions.
- Tests semester permissions.
- Tests subject permissions.
- Tests teacher activity ownership.
- Tests contact-message privacy.
- Tests the default-deny fallback.

The documented emulator baseline is 44 passed assertions and 0 failures.

## Deployment Checklist

1. Install dependencies.
2. Configure Firebase credentials for the intended project.
3. Configure Authentication providers.
4. Configure Firestore.
5. Configure the email worker URL.
6. Configure the email worker secret locally.
7. Deploy Firestore rules.
8. Deploy Firestore indexes.
9. Run rules tests.
10. Create an administrator account.
11. Create teacher accounts.
12. Create semesters.
13. Create classes.
14. Import or create students.
15. Create subjects.
16. Assign subjects to teachers and classes.
17. Assign CRs.
18. Take a test attendance session.
19. Confirm absent email delivery.
20. Confirm the worker response in browser logs.
21. Confirm student attendance calculations.
22. Confirm teacher correction behavior does not resend email.
23. Confirm announcement delivery.
24. Confirm contact form submission.
25. Confirm administrator message review.
26. Build the production application.

## Operational Verification Checklist

- Admin can log in.
- Teacher can log in.
- Student can log in.
- Incorrect credentials are rejected.
- Protected routes redirect correctly.
- Teacher creation keeps admin logged in.
- Class creation creates the expected roster.
- Student search works.
- Student ordering persists.
- CR assignment persists.
- Teacher assignments appear on the teacher dashboard.
- Subject class assignment appears for students.
- Class attendance saves.
- Lab attendance counts three periods.
- All-present action works.
- All-absent action works.
- Swipe attendance works.
- List attendance works.
- Mandatory Unit validation works.
- Topic is persisted.
- Attendance sheet reflects saved data.
- Attendance correction changes totals.
- Re-saving a date does not double totals.
- Absent email request is made when configured.
- Manual correction does not resend absent email.
- Student dashboard percentage is correct.
- Low-attendance threshold is correct.
- Excel export opens correctly.
- Announcements appear for the right audience.
- Navbar unread indicator updates.
- Contact message reaches administrators.
- Message read status updates.
- Logout clears the student session.
- Mobile layout remains usable.

## Known Limitations

- Student authentication is anonymous plus client-side password comparison.
- Legacy student passwords are stored as plaintext profile fields.
- Anonymous CR attendance writes cannot be strongly tied to one CR identity.
- Email delivery depends on an external Cloudflare Worker.
- Email delivery is not retried by the frontend.
- Email delivery status is not persisted.
- Push notification sending is not implemented in this repository.
- The Firebase web configuration is client-side configuration.
- Real Firebase behavior still requires deployment and end-to-end verification.
- Historical rollups may require a one-time rebuild.
- Missing Firestore indexes can increase read costs.
- The project has no license file.
- The project does not contain an in-repository backend server.

## Recommended Security Improvements

1. Create a real Firebase Auth account for every student.
2. Use the student Auth UID as the profile document ID or store a verified UID.
3. Remove plaintext passwords from `users`.
4. Store password hashes only in a protected migration collection if a custom
   authentication design is retained.
5. Restrict student reads to their own profile and attendance.
6. Restrict CR writes by checking the authenticated UID against `crIds`.
7. Move email dispatch behind a trusted server or Cloud Function.
8. Avoid exposing long-lived worker secrets in a browser bundle.
9. Store email delivery audit results.
10. Add retry and dead-letter handling for failed notifications.
11. Add rate limiting for public contact submissions.
12. Add automated end-to-end authorization tests.

## Recommended Email Improvements

- Read a verified email address from the student profile.
- Validate institutional email addresses before sending.
- Send through a trusted server-side service.
- Queue notifications instead of blocking the attendance save path.
- Store delivery state such as queued, sent, failed, and retried.
- Add an email template version.
- Include subject, date, teacher, class, and attendance status.
- Avoid sending duplicate notifications on unchanged resubmissions.
- Add administrator delivery monitoring.
- Add a test mode that sends only to a configured test recipient.

## Architectural Summary

The application follows a client-side React architecture with Firebase as the
backend-as-a-service layer. Pages own screen-level state. Shared controls live
under `components/common`. Authentication state is provided through Context API.
Firebase reads and writes are centralized in `firebase/services.js`. Utility
modules provide caching, date handling, attendance calculations, spreadsheet
processing, and downloadable reports.

The main data relationship is:

```text
Semester
  └── Subject
        └── Class assignment
              └── Students
                    └── Attendance records
```

Teachers operate on assigned subjects and classes. Students operate on the
class and semester assigned to their profile. Administrators configure the
academic structure and monitor system-wide statistics.

## Final Feature Summary

The implemented project includes:

- Role selection.
- Admin login.
- Teacher login.
- Student login.
- Protected routing.
- Staff authentication.
- Anonymous student sessions.
- Admin dashboards.
- Teacher dashboards.
- Student dashboards.
- Teacher creation.
- Bulk teacher import.
- Class creation.
- Bulk student import.
- Class editing.
- Student editing.
- Student deletion.
- Student reordering.
- Class reordering.
- CR assignment.
- Semester creation.
- Semester deletion.
- Subject creation.
- Subject editing.
- Subject deletion.
- Teacher assignment.
- Class-to-subject assignment.
- Attendance recording.
- Swipe attendance.
- List attendance.
- Class sessions.
- Lab sessions.
- Mandatory unit logging.
- Optional topic logging.
- Attendance correction.
- Attendance rollups.
- Low-attendance scanning.
- Global low-attendance scanning.
- Attendance charts.
- Attendance matrices.
- CR attendance.
- Teacher activity logging.
- Teacher activity editing.
- Teacher activity deletion.
- Announcement creation.
- Announcement deletion.
- Realtime announcement updates.
- Unread announcement indicators.
- Contact form submission.
- Administrator message review.
- Mark-as-read messages.
- Student and teacher password changes.
- Excel imports.
- Excel templates.
- Attendance exports.
- Low-attendance exports.
- Activity exports.
- CR attendance exports.
- Firebase persistent cache.
- Application cache.
- Incremental synchronization.
- Batched writes.
- Firestore aggregate counts.
- Security rules.
- Security-rule emulator tests.
- PWA manifest.
- Responsive navigation.
- Mobile layouts.
- Toast notifications.
- Loading states.
- Skeleton states.
- Firebase Messaging integration point.
- FCM token storage.
- Absent-student email notification through Cloudflare Worker.
- Email suppression for manual corrections.
- Email worker error logging.
- Firestore index configuration.
- Firebase deployment configuration.

This README describes the source currently present in the project. External
services, including the Cloudflare email worker and any future push-notification
sender, must be deployed and configured separately.

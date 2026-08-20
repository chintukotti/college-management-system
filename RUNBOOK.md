# Project Runbook

**Last session:** 20 Aug 2026
**Status:** Code complete and building clean — **app behaviour not yet verified
against real Firebase**. Security rules *are* verified (44/44 on the emulator).

Start here when picking the work back up.

---

## 1. Where things stand

Five things were requested last session, and all five are implemented:

| # | Request | State |
|---|---|---|
| 1 | Optimization / caching | Done |
| 2 | Cut Firebase reads for 1,500 students on free tier | Done (estimates, not measured) |
| 3 | Sort teachers by name, ignoring honorifics | Done + unit tested |
| 4 | Improve Manage Classes UI | Done (not seen running) |
| 5 | Responsiveness pass | Done — structural audit clean |
| + | Firestore security rules (backlog item) | Added and emulator-tested |

**Verified:** `CI=true npm run build` compiles clean; bundle 505 kB → 223 kB gzipped;
honorific sorting passes 11 unit tests; production build loads in a browser with no
console errors; all service imports resolve; **security rules pass 44/44 against the
Firestore emulator**; responsive audit found every table wrapped in a scroll
container, every modal capped at `max-h-[90vh]`, no fixed widths that break at
320 px, and no multi-column grid without a breakpoint.

**Not verified:** nothing behind a login was ever run — no admin, teacher or student
page, and no real Firestore read or write. The read-reduction figures are calculated,
not measured.

---

## 2. Do these two things first

Nothing else should be trusted until both are done.

```bash
npm install -g firebase-tools   # not installed on this machine
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

**This command could not have worked before now** — there was no `firebase.json`,
so the CLI had nothing pointing at `firestore.indexes.json`. `firebase.json` and
`.firebaserc` (project `cm-system-c3de7`) now exist.

Without the indexes the app still works — the sync falls back to full fetches and
just costs more reads. The **rules**, by contrast, change access immediately:
read `SECURITY.md` before deploying them, and note they can be rolled back from
the Firebase console (Firestore → Rules → history).

**2. Backfill attendance totals — once per class.**
Attendance recorded *before* last session has no rollup, so low-attendance tracking
will look empty for those classes.

- One class: admin → open the class → **Rebuild Totals**
- All classes: **Manage Classes → Students below 75% → Rebuild totals**

This is the one deliberately expensive operation (it reads every existing attendance
record once). With a lot of history, do it class by class across a few days to stay
inside the daily quota. New attendance maintains its own totals, so this is never
needed again.

---

## 3. Test checklist — in risk order

**Highest risk first.** The attendance save path was rewritten from "one write per
student" into a batched save with delta math, and has never actually run.

- [ ] **Take attendance for one class** → sheet shows correct counts
- [ ] **Toggle Class↔Lab after marking some students**, then save → everyone
      present shows full attendance, nobody shows 33% or 300%
- [ ] **Manual entry: set max 3, save, reopen the modal** → counts start at 1,
      not 3; lowering the max pulls the inputs down with it
- [ ] **Log out as a student, then press Back** → you land on the login page,
      not back inside the dashboard
- [ ] **Add a teacher** → they appear in Manage Teachers immediately (this was
      cached for an hour); same for a new class and a new student
- [ ] **Add and delete a student** → the class card's student count moves both ways
- [ ] **Delete a class that had subjects** → the class disappears from those
      subjects for the teacher too
- [ ] **Re-save the same date** → totals do *not* double (this is the delta logic)
- [ ] **Lab session (×3)** → present student counts 3, absent counts 3 toward total
- [ ] **Manual entry** (Add Entry on the sheet) → attended/total split is right
- [ ] **Edit an attendance record** → totals adjust rather than drift
- [ ] Manage Teachers → sorted by real name, not by "Dr."
- [ ] Manage Classes → new layout renders; "Students below 75%" returns sane results
- [ ] Student dashboard → percentages match what they were before the change
- [ ] Post an announcement → navbar dot and announcements page update live
- [ ] Open several screens on a real phone
- [ ] **After deploying rules:** student login, CR takes attendance, teacher saves
      attendance, admin opens Manage Classes, contact form submits — a rules
      mistake surfaces as `permission-denied` in the console

**If totals ever look wrong:** "Rebuild Totals" recomputes from the raw attendance
records. The attendance documents themselves were never restructured, so nothing is
unrecoverable.

---

## 4. What changed, and why

### New files
| File | Purpose |
|---|---|
| `src/utils/cache.js` | Two-layer TTL cache (memory + localStorage) with quota handling |
| `firestore.indexes.json` | Composite indexes for incremental sync + navbar dot |
| `OPTIMIZATION.md` | Full write-up of the read optimization and its numbers |

### The four ideas behind the optimization

Understand these before changing the data layer — they are load-bearing.

1. **Incremental attendance sync.** `getAttendanceForStudent` /
   `getAttendanceForSubjectAndClass` cache records on-device and then fetch only rows
   dated `>= lastSync`. Uses `>=` (not `>`) so same-day teacher corrections still
   arrive; full refresh every 24h. Falls back to a full fetch if the index is missing.

2. **Class-document rollups.** `classes/{id}.attendanceStats[studentId][subjectId] =
   {present, total}`, maintained as attendance is saved. Turns "who is below 75%?"
   into **one read per class** instead of a query per student.

3. **Count without reading.** `getCountFromServer()` bills 1 read per 1,000 documents
   counted — the admin dashboard no longer downloads 1,500 student docs to count them.

4. **Batched session writes.** `saveSessionAttendance()` = one batch + one subject
   write + one rollup write. Was 120 writes for a 60-student class, now 62.

### Key service functions added
```
saveSessionAttendance()          — save a whole class in one batch (use this, not markAttendance)
updateAttendanceBatch()          — apply edits + adjust rollups by delta
applyClassAttendanceDelta()      — single write updating totals for a whole class
getClassLowAttendance()          — below-threshold students, 1 read
getGlobalLowAttendance()         — same across all classes, 1 read per class
recomputeClassAttendanceStats()  — backfill / repair one class (expensive)
recomputeAllClassesStats()       — backfill all classes (expensive)
getRoleCount() / getCollectionCount() / getUnreadMessageCount()
subscribeToClassAnnouncements()  — realtime, cache-seeded
subscribeToLatestAnnouncement()  — realtime dot, watches 1 doc
clearAllCaches()                 — called on logout
```

### Bugs found in the review pass (21 Aug)

Found by reading the code, not by running it — all six compile clean and are
consistent with the rest of the data layer, but none has been exercised against
real Firebase.

1. **Attendance was filed under the wrong day before ~05:30.** Dates came from
   `toISOString()`, which converts to UTC; at UTC+5:30 anything before 05:30
   local resolved to *yesterday*. Since the date is part of the attendance
   document id and writes use `merge: true`, a 00:30 session silently
   **overwrote the previous day's records** and skewed both days' totals. Now a
   single local-time `getTodayDate()` in `src/utils/helpers.js`, used everywhere.
2. **Logging out did not log a student out.** Students stay signed in
   anonymously, so `logoutUser('student')` never fires `onAuthStateChanged` and
   `AuthContext` kept them populated — `ProtectedRoute` let them straight back
   in until a page reload. Added `clearStudentSession()`.
3. **A corrupt `studentSession` bricked the app.** `JSON.parse` ran unguarded
   inside the async auth callback, so a throw skipped `setLoading(false)` and
   the provider rendered nothing — a permanent white screen recoverable only by
   clearing localStorage by hand.
4. **Switching Class↔Lab mid-session corrupted counts.** `count` was captured
   when each student was marked but `maxCount` came from the toggle's final
   value, so a fully-present student could roll up as 1-of-3 — or 3-of-1, i.e.
   300%. Now derived at save time.
5. **The manual-entry modal reopened with stale counts.** It seeded every
   student from the *previous* `manualMaxCount` and then reset the max to 1,
   leaving untouched students at 3-of-1. Lowering the max mid-edit also left the
   inputs showing values above it.
6. **Student dashboard could show over 100%.** The denominator was summed over
   the student's subjects while the numerator was summed over their attendance
   records, so a record whose subject was no longer assigned counted in one but
   not the other. Both now come from the same per-subject stats.

`saveSessionAttendance` also clamps `count` into `[0, maxCount]` now, so no
caller can put an impossible figure into the rollups regardless of UI state.

**Second pass — stale data and drift:**

7. **New records stayed invisible for up to an hour.** Eight write functions
   never invalidated the caches they dirtied — `registerUser`,
   `registerStudentWithId`, `registerTeachersFromExcel`,
   `createClassWithStudents`, `updateClassWithStudents`,
   `createSubjectsFromExcel`, `changeStudentPassword` and
   `updateAttendanceForActivityLog`. Teacher and class lists are cached for a
   full hour, so **adding a teacher and landing on Manage Teachers showed a list
   without them** until the TTL expired. Invalidation now lives in the service
   layer, so every caller gets it.
8. **`studentCount` drifted permanently.** Shown on every class card and in the
   admin total, but only written at class creation and on bulk import — adding
   or deleting a single student left it untouched. Now maintained with
   `increment()` in `registerStudentWithId` / `deleteUser`; `EditClass` no
   longer writes it from stale local state.
9. **Deleting a class left phantom classes on subjects.** Subjects kept their
   `classes` entry, so teachers saw a class with no students and could click
   through to take attendance for something that no longer existed.
   `deleteClass` now detaches the class from every subject that referenced it.
   (Subjects carrying only the legacy single `classId` field are not matched by
   that query.)
10. **Removed dead `updateAttendance()`** — no callers, and it wrote attendance
    without touching the rollups or caches, so anyone wiring it up later would
    have silently desynced the totals. `addClassToSubject` /
    `removeClassFromSubject` are also unused, and `removeClassFromSubject` does
    not update the `classes` array it would need to; leave them alone or delete
    them, but don't call them as-is.

### Bugs fixed in the optimization pass
- `updateStudentAttendanceStats` called an undefined `serverIncrement` — precomputed
  stats had **never** worked
- `getStudentsByClassPaginated` and `getRecentAttendance` named a parameter `limit`,
  shadowing Firestore's `limit()` — both always threw
- `updateSubject` didn't sync `classIds` with `classes`, which is what forced the
  full-collection subject scan (now removed)
- Reorder drag handle was `hidden sm:block` — reordering was impossible on phones
- `CI=true` build failed on ~60 lint warnings, which would have **broken a Netlify
  deploy**

---

## 5. Known risks / gotchas

- **Double-counting guard.** `saveSessionAttendance` decides whether to look up
  previous records using the subject doc's `classDates[classId]`, read *fresh* (not
  cached) for exactly this reason. If you touch that path, keep the fresh read.
- **Cache invalidation is write-driven.** Any new write path must invalidate the
  relevant cache keys or the UI will show stale data. Follow the existing
  `invalidateClassCaches` / `invalidateSubjectCaches` / `invalidateUserCaches` helpers.
- **Cross-device staleness.** Caches are per-device. A teacher's edit invalidates
  their own cache; other users see it after the TTL expires (2 min – 1 h depending on
  the entry) or on a forced refresh. Most read functions accept a `force` flag.
- **`react-hooks/exhaustive-deps` is off** in `package.json`. Deliberate: ~20
  components fetch on mount, and adding the deps would risk infinite loops. Revisit
  only with proper `useCallback` refactoring.

---

## 6. Backlog — deliberately not done

- **Security — partly done, see `SECURITY.md`.** Rules now exist and are tested:
  students can no longer write attendance, post announcements, escalate their own
  role, or read the contact-form inbox (which was world-readable). Two gaps remain
  and **no rule can close them**, because students sign in *anonymously* — there is
  no identity in the request to check:
  - Student passwords are plaintext on the user document, and the CR roster query
    means anonymous sessions can list `users`. → `SECURITY.md` **Fix 1** (contained:
    move credentials to their own get-only collection).
  - Anyone signed in can write `classAttendance`, because CRs are anonymous too.
    → `SECURITY.md` **Fix 2** (real student accounts; closes both gaps).
- **Data-model migration.** One attendance doc per *session* (instead of per student
  per session) would cut writes much further, but it's invasive and untestable without
  a real environment. Considered and rejected for now.
- **Measure the actual read counts** in the Firebase console after a few days of real
  use, and compare against the estimates in `OPTIMIZATION.md`.
- Visual/responsive check of every authenticated page. The *structural* audit is
  done and clean; what is left is looking at real screens with real data — long
  student names, 40-subject tables, wide attendance sheets.

---

## 7. Commands

```bash
npm start                        # dev server
CI=true npx react-scripts build  # build exactly as the deploy pipeline does
npx serve -s build -l 4173       # serve the production build locally
firebase deploy --only firestore:rules,firestore:indexes

npm run test:rules               # security rules, against the emulator
```

`test:rules` needs Java (present) and downloads the emulator on first run. It
touches only the emulator — no credentials, and no contact with your live project.
`@firebase/rules-unit-testing` was added as a **devDependency**; it is not in the
production bundle.

---

## 8. Context worth keeping

- Stack: React 19, CRA 5, Tailwind 3, Firebase 12 (Auth + Firestore), no test suite.
- Target scale: ~1,500 students, ~50 teachers, 40+ subjects, Firestore **free tier**
  (50k reads / 20k writes per day) — that constraint drove every decision here.
- Routes are lazily loaded (`src/App.jsx`); heavy libs (xlsx ~141 kB, chart.js ~69 kB)
  only load on the pages that use them. Keep new heavy imports out of shared modules.

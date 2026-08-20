# Firebase Read Optimization

How this app stays inside the Firestore free tier (Spark: 50,000 reads, 20,000
writes per day) at a scale of ~1,500 students, ~50 teachers and 40+ subjects.

---

## The problem

Four things dominated the read bill, and one of them could exhaust a whole day's
quota with a single click:

| Action | Reads before | Why |
|---|---:|---|
| Student opens dashboard | ~330 | Re-read the student's entire attendance history every time |
| **All students, 1.5 loads/day** | **~500,000/day** | 10× over the daily limit on its own |
| Admin: "Students below 75%" | **~500,000 per click** | A query per student, nested inside a query per class |
| Admin dashboard | ~1,700 | Downloaded 1,500 student docs just to call `.length` |
| Teacher opens attendance sheet | ~2,400 | Full re-read of every record for that subject + class |

Writes were wasteful too: saving attendance for a 60-student class issued
**120 writes**, because each student's `markAttendance` call also wrote the same
shared subject document.

---

## What changed

### 1. Incremental attendance sync (the big one)

`getAttendanceForStudent` and `getAttendanceForSubjectAndClass` cache records on
the device and then fetch only what is dated on or after the last sync
(`where('date', '>=', syncedThrough)`).

- First load on a device: full history (one time).
- Every load after: only new records — typically a handful.
- Re-reading the most recent day (`>=`, not `>`) means a teacher's same-day
  correction is still picked up.
- The full set is refreshed once every 24 hours, so any older edit lands then.
- If the composite index is missing the query throws, and the code falls back to
  a full fetch — correctness never depends on the index being deployed.

### 2. Attendance totals live on the class document

`classes/{classId}.attendanceStats[studentId][subjectId] = { present, total }`

Kept up to date as attendance is saved, so "who is below 75%?" is **one document
read per class** instead of a query per student.

- Per class: ~19,000 reads → **1** (plus the class roster, which is cached)
- Admin's global scan (25 classes): ~500,000 reads → **25 stat reads**, plus one
  roster query per class on a cold cache. The rollup removes the per-student
  attendance queries, not the roster lookup.

### 3. Counting without reading

The admin dashboard uses `getCountFromServer()`. Firestore bills one read per
1,000 documents counted, so counting 1,500 students costs **2 reads, not 1,500**.

### 4. Batched session writes

`saveSessionAttendance()` writes the whole class in one batch, touches the
subject document once, and updates the class rollup once:

- **120 writes → 62** for a 60-student class
- No more 60 concurrent updates contending on the same subject document

### 5. TTL cache in front of every hot query

`src/utils/cache.js` — memory + `localStorage`, with write-driven invalidation
so edits show up immediately. Classes, subjects, rosters, semesters and
announcements are all served from cache on repeat navigation.

### 6. Announcements: still realtime, no longer expensive

Announcements update instantly — that behaviour is deliberate and kept. What
changed is the cost of delivering it.

**The navbar dot** opened a realtime listener over **all** of the class's
announcements. Because each of the 28 pages mounts its own navbar, every
navigation tore that listener down and rebuilt it, re-reading the whole
collection just to find the newest timestamp. At 50 announcements and 5
navigations a day that was ~250 reads per student per day (~375,000/day across
1,500 students) for a single red dot.

It now watches `orderBy('createdAt','desc'), limit(1)` — **one** document. Still
live, but a listener attach costs 1 read instead of 50.

**The announcements page** keeps its full realtime listener, with two changes:

- The cached copy renders immediately, so revisiting the page shows content
  instantly instead of a spinner while the first snapshot arrives.
- Firestore's persistent cache (see below) lets a re-attached listener resume
  from where it left off and download only what changed, instead of re-reading
  every announcement on each visit.

Every snapshot also refreshes the shared cache, so the navbar and the page stay
in step without either issuing extra reads.

### 7. Removed a full-collection scan

`getSubjectsForStudent` had a fallback that read **every subject in the
database** whenever a class had no subjects yet. Its root cause is also fixed:
`updateSubject` now keeps `classIds` in sync with the `classes` array, so the
indexed query always works.

---

## Result

| | Before | After |
|---|---:|---:|
| Student dashboard (returning) | ~330 reads | ~2–10 reads |
| Navbar unread dot (per navigation) | ~50 reads | 1 (still live) |
| Announcements page (revisit) | ~50 reads | changed docs only |
| All students per day | ~875,000 | **~25,000** |
| Admin low-attendance scan | ~500,000 | **~25** + rosters (cached) |
| Admin dashboard | ~1,700 | ~6 |
| Teacher attendance sheet (repeat) | ~2,400 | ~0–20 |
| Attendance save (60 students) | 120 writes | 62 writes |

Comfortably inside the free tier, with headroom to grow.

Also: route-level code splitting cut the initial JS bundle from **505 kB to
232 kB gzipped**, so a student's phone no longer downloads the admin console,
Excel parser and charting library to check their attendance.

---

## Deployment steps

### 1. Deploy the indexes (recommended)

```bash
firebase deploy --only firestore:indexes
```

Without them the app still works — incremental sync just falls back to full
fetches, costing more reads. Firebase also prints a one-click index-creation
link the first time such a query runs.

### 2. Backfill attendance totals (one time)

Attendance recorded *before* this change has no rollup, so low-attendance
tracking will look empty for those classes. Backfill once:

- **One class:** open it in the admin panel → "Rebuild Totals"
- **All classes:** Manage Classes → "Students below 75%" → "Rebuild totals"

This is the one deliberately expensive operation: it reads every existing
attendance record once. If you have a lot of history, do it class by class
across a few days to stay inside the daily quota. New attendance keeps its
totals current automatically, so this is never needed again.

### 3. Check your security rules

Client-side role checks are convenience, not security. Firestore rules are what
actually stop a student from reading another class's data — make sure they are
enforced server-side. Note that student passwords are currently stored as
plaintext fields on `users` documents; if you ever move students to real
Firebase Auth accounts, that field should go away.

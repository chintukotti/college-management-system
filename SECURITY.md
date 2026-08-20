# Security

Status of access control in this project, what the new rules actually enforce,
and the two things that still need fixing.

---

## What just changed

The database had **no security rules in this repo**. Whatever is deployed in the
Firebase console was the only thing standing between a curious student and every
other student's data. Role checks in the React code (`ProtectedRoute`, `userRole`)
are navigation convenience — anyone can bypass them by calling Firestore directly
from the browser console.

Three files were added:

| File | Purpose |
|---|---|
| `firestore.rules` | The rules themselves |
| `firestore.rules.test.mjs` | 44 assertions run against the Firestore emulator |
| `firebase.json` / `.firebaserc` | Deploy config — **neither existed**, so `firebase deploy` had nothing to read |

> Note: `firebase deploy --only firestore:indexes` (step 1 in RUNBOOK) could not
> have worked before this, because there was no `firebase.json` pointing at
> `firestore.indexes.json`.

---

## Verified

Run against the real Firestore emulator, **44 passed / 0 failed**:

```bash
npm run test:rules
```

What the rules now stop, that they did not stop before:

- A student **cannot** write attendance records, post announcements, edit
  subjects, or modify a class document.
- A student **cannot** escalate their own role to `admin`. Change Password still
  works, but the write is clamped to the `password` field alone — any write that
  touches a second field is rejected.
- A student **cannot** create or delete user accounts.
- A teacher **cannot** create users, delete semesters, or read another teacher's
  activity log.
- **Contact form messages are no longer world-readable.** Anyone may submit one;
  only an admin can read them back. Every name, email and message left on the
  public contact form was previously readable by anyone.
- Any collection not explicitly listed is denied.

The suite also asserts that the paths the app depends on still work — student
dashboard reads, CR roster lookup, teacher rosters, admin queries — so the rules
are not merely strict, they are strict *and* compatible.

---

## Not fixed — and why rules cannot fix it

Both gaps come from the same root cause, so read this before deciding what to do.

**Students have no real identity.** `loginUser()` signs the browser in
**anonymously**, fetches `users/{studentId}`, and compares the password *in
JavaScript*. So `request.auth.uid` is a throwaway anonymous id with no
relationship to any student. A rule can ask "is somebody signed in?" but never
"is this *that* student?" — the information does not exist in the request.

### Gap 1 — student passwords are readable (high)

Passwords are stored as **plaintext** on the user document. Rules grant whole
documents, never single fields, so any rule permissive enough for login is also
permissive enough to hand over the password.

It is worse than one document at a time: the CR attendance page queries the
roster (`getStudentsByClass`), so anonymous sessions must be able to *query*
`users`. That lets anyone page through all 1,500 students and read every
password. `firestore.rules` documents this at the rule itself.

### Gap 2 — anyone can write class attendance (medium)

Class representatives are students, so CR writes happen anonymously. `crIds` on
the class document records who the CRs are, but the rule has no identity to
compare it against. Any anonymous session can write `classAttendance`.

---

## Fix 1 — get the password off the user document

Contained, no auth-model change, closes the mass-scraping half of Gap 1.

Split credentials into their own collection, so a *query* over `users` can never
return a password:

- `users/{studentId}` — profile only, no `password` field
- `studentAuth/{studentId}` — `{ passwordHash }` and nothing else

Rule: `allow get` (login fetches one known id), **never** `allow list`. An
attacker must then already know a student id to attempt anything, and gets a
hash rather than a password.

Touch points — all in `src/firebase/services.js`:

1. `loginUser()` — read `studentAuth/{id}` for the credential, `users/{id}` for the profile
2. `changeStudentPassword()` — read/write `studentAuth/{id}`
3. Student creation (`registerStudentWithId`, bulk upload in `CreateClass` / `AddTeacher`) — write both documents
4. A one-time migration moving every existing `password` into `studentAuth`, then deleting the field
5. Hash with bcrypt/scrypt rather than storing plaintext

Then in `firestore.rules`, `users` list access is safe, and the `studentAuth`
block is `allow get: if signedIn(); allow list: if false;`.

## Fix 2 — give students real accounts

The complete fix. Closes both gaps and everything downstream of them.

Create a real Firebase Auth account per student — either
`{studentId}@students.<college>.edu` with email/password, or custom tokens minted
by a Cloud Function. `request.auth.uid` then *is* the student id, and the rules
become the ones you actually want:

```
// a student reads only their own record
allow get: if request.auth.uid == userId || staff();

// only a real CR of that class may write its attendance
allow write: if request.auth.uid in
  get(/databases/$(database)/documents/classes/$(request.resource.data.classId)).data.crIds;
```

Firebase Auth also handles hashing, rate limiting and password reset, so the
`password` field disappears entirely. Note this needs a migration for existing
students and a change to the student login screen.

---

## Deploying

**Read `firestore.rules` before deploying it.** Rules take effect immediately and
a mistake locks out real users.

```bash
npm install -g firebase-tools     # not currently installed
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

Test first if you can — the emulator command above needs no credentials and no
network access to your live project:

```bash
npm run test:rules
```

Rules can be rolled back from the Firebase console (Firestore → Rules → history).

---

## Smaller notes

- The Firebase config in `src/firebase/config.js` is **not** a secret; client API
  keys are public by design. Security rules are what protect the data, which is
  exactly why the above matters.
- `logoutUser()` clears local caches, so one account's cached data is not left
  behind for the next sign-in on a shared device.
- Student sessions live in `localStorage` (`studentSession`) with no expiry — a
  shared or lost device stays logged in until someone clicks Logout.

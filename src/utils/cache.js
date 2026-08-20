// src/utils/cache.js
//
// Lightweight TTL cache used to cut Firebase document reads.
//
// Two layers:
//   1. In-memory  — survives navigation within a page session (fastest, no JSON cost)
//   2. localStorage — survives reloads and browser restarts
//
// Every cached entry stores { t: savedAt, d: data }. Reads pass the max age they
// tolerate, so the same entry can be treated as fresh by one caller and stale by
// another without duplicating storage.

const PREFIX = 'cms_cache_v2:';

// Common TTLs (ms)
export const TTL = {
  SHORT: 2 * 60 * 1000,        // 2 min  — volatile lists (messages)
  MEDIUM: 10 * 60 * 1000,      // 10 min — students, attendance
  LONG: 60 * 60 * 1000,        // 1 hour — classes, subjects, teachers
  DAY: 24 * 60 * 60 * 1000,    // 1 day  — semesters, rarely-edited structures
};

// ---------------------------------------------------------------------------
// In-memory layer
// ---------------------------------------------------------------------------

const memory = new Map();

// ---------------------------------------------------------------------------
// Storage helpers (defensive — private mode / quota / disabled storage)
// ---------------------------------------------------------------------------

const storage = (() => {
  try {
    const probe = '__cms_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
})();

/** Drop the oldest half of our cached entries — called when quota is hit. */
const evictOldest = () => {
  if (!storage) return;
  try {
    const entries = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const { t } = JSON.parse(storage.getItem(key)) || {};
        entries.push([key, t || 0]);
      } catch {
        entries.push([key, 0]);
      }
    }
    entries.sort((a, b) => a[1] - b[1]);
    entries.slice(0, Math.ceil(entries.length / 2)).forEach(([key]) => storage.removeItem(key));
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Read a cached entry.
 * @param {string} key
 * @param {number} maxAge - Maximum tolerated age in ms
 * @returns {*} Cached data, or null when missing/stale
 */
export const getCache = (key, maxAge = TTL.MEDIUM) => {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && now - mem.t < maxAge) return mem.d;

  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    if (now - parsed.t >= maxAge) return null;
    memory.set(key, parsed);
    return parsed.d;
  } catch {
    return null;
  }
};

/**
 * Read a cached entry along with the time it was stored.
 * Used by incremental sync, which needs to know how stale the data is.
 * @returns {{data: *, savedAt: number}|null}
 */
export const getCacheEntry = (key) => {
  const mem = memory.get(key);
  if (mem) return { data: mem.d, savedAt: mem.t };

  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    memory.set(key, parsed);
    return { data: parsed.d, savedAt: parsed.t };
  } catch {
    return null;
  }
};

/** Store an entry in both layers. */
export const setCache = (key, data) => {
  const entry = { t: Date.now(), d: data };
  memory.set(key, entry);

  if (!storage) return;
  try {
    storage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Most likely QuotaExceededError — make room and retry once.
    evictOldest();
    try {
      storage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      /* give up: memory layer still serves this session */
    }
  }
};

/** Remove one entry. */
export const invalidate = (key) => {
  memory.delete(key);
  if (!storage) return;
  try {
    storage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
};

/** Remove every entry whose key starts with `prefix`. */
export const invalidatePrefix = (prefix) => {
  Array.from(memory.keys()).forEach((key) => {
    if (key.startsWith(prefix)) memory.delete(key);
  });

  if (!storage) return;
  try {
    const doomed = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX + prefix)) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    /* ignore */
  }
};

/** Wipe the whole cache (used on logout). */
export const clearCache = () => {
  memory.clear();
  if (!storage) return;
  try {
    const doomed = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    /* ignore */
  }
};

/**
 * Cache-aside wrapper around a service call.
 *
 * The fetcher must resolve to the app's standard { success, data } shape;
 * only successful results are cached, so a transient failure never poisons
 * the cache.
 *
 * @param {string} key
 * @param {number} maxAge
 * @param {Function} fetcher - async () => ({ success, data })
 * @param {boolean} force - Skip the cache and refetch
 */
export const withCache = async (key, maxAge, fetcher, force = false) => {
  if (!force) {
    const hit = getCache(key, maxAge);
    if (hit !== null) return { success: true, data: hit, fromCache: true };
  }

  const result = await fetcher();
  if (result?.success && result.data !== undefined) setCache(key, result.data);
  return result;
};

// ---------------------------------------------------------------------------
// Key builders — keeps key strings consistent across the app
// ---------------------------------------------------------------------------

export const keys = {
  classes: (adminId) => `classes:${adminId}`,
  classById: (classId) => `class:${classId}`,
  usersByRole: (role, adminId) => `users:${role}:${adminId || 'all'}`,
  studentsByClass: (classId) => `students:${classId}`,
  subjectsByTeacher: (teacherId) => `subjects:teacher:${teacherId}`,
  subjectsBySemester: (semesterId) => `subjects:semester:${semesterId}`,
  subjectsForStudent: (classId) => `subjects:class:${classId}`,
  subjectById: (subjectId) => `subject:${subjectId}`,
  allSubjects: (adminId) => `subjects:all:${adminId || 'all'}`,
  semesters: (adminId) => `semesters:${adminId || 'all'}`,
  semesterById: (semesterId) => `semester:${semesterId}`,
  studentAttendance: (studentId) => `att:student:${studentId}`,
  subjectClassAttendance: (subjectId, classId) => `att:sc:${subjectId}:${classId}`,
  classAttendance: (classId) => `att:class:${classId}`,
  announcementsByTeacher: (teacherId) => `ann:teacher:${teacherId}`,
  contactMessages: () => 'messages',
  adminCounts: (adminId) => `counts:${adminId}`,
  teacherActivity: (teacherId, subjectId) => `activity:${teacherId}:${subjectId || 'all'}`,
};

const cacheApi = {
  TTL,
  keys,
  getCache,
  getCacheEntry,
  setCache,
  invalidate,
  invalidatePrefix,
  clearCache,
  withCache,
};

export default cacheApi;

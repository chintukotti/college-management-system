// src/utils/helpers.js

/**
 * Format date to readable string
 * @param {Date|string|Object} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  // Handle Firestore timestamp
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return dateObj.toLocaleDateString('en-US', defaultOptions);
};

/**
 * Format date with time
 * @param {Date|string|Object} date - Date to format
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get today's date in YYYY-MM-DD format, in the LOCAL timezone.
 *
 * Not toISOString(), which converts to UTC first. India runs at UTC+5:30, so
 * any time before 05:30 local resolves to the previous day — attendance taken
 * just after midnight was being filed under yesterday. Because the date is part
 * of the attendance document id, that silently overwrote the previous day's
 * records instead of creating new ones.
 *
 * @param {Date} [date] - Defaults to now
 * @returns {string} Date as YYYY-MM-DD
 */
export const getTodayDate = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Calculate attendance percentage
 * @param {number} present - Number of present days
 * @param {number} total - Total number of days
 * @returns {number} Percentage (0-100)
 */
export const calculateAttendancePercentage = (present, total) => {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
};

/**
 * Get attendance status color class
 * @param {number} percentage - Attendance percentage
 * @returns {string} Tailwind color class
 */
export const getAttendanceColor = (percentage) => {
  if (percentage >= 75) return 'text-green-600';
  if (percentage >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Get attendance background color class
 * @param {number} percentage - Attendance percentage
 * @returns {string} Tailwind background color class
 */
export const getAttendanceBgColor = (percentage) => {
  if (percentage >= 75) return 'bg-green-100';
  if (percentage >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Generate a random color for avatars
 * @param {string} name - Name to generate color from
 * @returns {string} Hex color code
 */
export const getAvatarColor = (name) => {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];
  
  if (!name) return colors[0];
  
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};


/**
 * Titles/honorifics stripped before sorting or comparing people's names.
 * Longest-first so "Prof." is matched before "Pro".
 */
const HONORIFICS = [
  'professor', 'prof', 'doctor', 'dr', 'mr', 'mrs', 'ms', 'miss',
  'sri', 'shri', 'smt', 'sir', 'madam', 'kum', 'er'
];

/**
 * Remove leading honorifics from a name so sorting uses the real name.
 * "Dr. Ramesh Kumar" -> "Ramesh Kumar", "Mrs Priya" -> "Priya"
 *
 * Only *leading* titles are removed: a surname that happens to look like a
 * title (e.g. "Kumar Mr") keeps its words.
 *
 * @param {string} name
 * @returns {string} Name without honorific prefixes
 */
export const stripHonorifics = (name) => {
  if (!name) return '';

  let result = String(name).trim();

  // Repeat so stacked titles ("Dr. Mrs. Anita") are fully removed
  let changed = true;
  while (changed) {
    changed = false;
    for (const title of HONORIFICS) {
      // Matches a leading title followed by either punctuation ("Dr.Aarti",
      // "Dr. Aarti") or whitespace ("Dr Aarti"). A separator is required, so
      // real names that merely start with those letters ("Drone") are safe.
      const pattern = new RegExp(`^${title}(?:\\s*[.,:]\\s*|\\s+)`, 'i');
      if (pattern.test(result)) {
        result = result.replace(pattern, '').trim();
        changed = true;
        break;
      }
    }
  }

  // A name that was *only* a title stays as-is rather than becoming empty
  return result || String(name).trim();
};

/**
 * Sort key for a person's name: honorifics removed, lowercased, punctuation
 * dropped so "J. Vishnu" and "J Vishnu" sort together.
 * @param {string} name
 * @returns {string}
 */
export const getNameSortKey = (name) => {
  return stripHonorifics(name)
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Comparator that sorts people alphabetically by name, ignoring honorifics.
 * Use with Array.prototype.sort on objects that have a `name` field.
 *
 * @param {Object} a - Object with a `name` property
 * @param {Object} b - Object with a `name` property
 * @returns {number}
 */
export const compareByName = (a, b) => {
  const keyA = getNameSortKey(a?.name);
  const keyB = getNameSortKey(b?.name);
  return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Calculate attendance statistics from an array of records
 * FIXED: Uses dateCapacities to get the correct grand total
 * @param {Array} records - Array of attendance objects
 * @returns {Object} - { present, absent, total, percentage }
 */
export const calculateAttendanceStats = (records) => {
  if (!records || records.length === 0) {
    return { present: 0, absent: 0, total: 0, percentage: 0 };
  }

  // Step 1: Build dateCapacities map - for each unique date, get max count
  const dateCapacities = {};
  const uniqueDates = [...new Set(records.map(r => r.date))];

  uniqueDates.forEach(date => {
    const recordsOnDate = records.filter(r => r.date === date);
    const maxCount = recordsOnDate.reduce((max, r) => Math.max(max, r.count || 1, r.maxCount || 1), 1);
    dateCapacities[date] = maxCount;
  });

  // Step 2: Calculate grand total from dateCapacities
  let total = 0;
  uniqueDates.forEach(date => {
    total += dateCapacities[date];
  });

  // Step 3: Calculate present count
  let present = 0;
  records.forEach(rec => {
    if (rec.status === 'present') {
      present += (rec.count || 1);
    }
  });

  const absent = total - present;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return { present, absent, total, percentage };
};

const helpers = {
  formatDate,
  formatDateTime,
  getTodayDate,
  calculateAttendancePercentage,
  getAttendanceColor,
  getAttendanceBgColor,
  isValidEmail,
  capitalizeWords,
  getAvatarColor,
  truncateText,
  groupBy,
  debounce,
  calculateAttendanceStats, // Added export
  stripHonorifics,
  getNameSortKey,
  compareByName
};

export default helpers;
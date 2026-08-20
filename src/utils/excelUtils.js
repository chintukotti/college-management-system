import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getTodayDate } from './helpers';

/**
 * Auto-calculate optimal column widths based on content
 * Scans header + all rows and picks the max length per column, with padding.
 * @param {Array<Array>} aoa - Array of arrays (header row + data rows)
 * @param {number} [minWidth=8] - Minimum column width
 * @param {number} [maxWidth=50] - Maximum column width
 * @param {number} [padding=2] - Extra padding chars
 * @returns {Array<{wch: number}>} Column width config for xlsx
 */
const autoFitColumns = (aoa, minWidth = 8, maxWidth = 50, padding = 2) => {
  if (!aoa || aoa.length === 0) return [];

  const colCount = Math.max(...aoa.map(row => row.length));
  const widths = [];

  for (let col = 0; col < colCount; col++) {
    let maxLen = minWidth;
    for (let row = 0; row < aoa.length; row++) {
      const cell = aoa[row]?.[col];
      const cellStr = cell !== null && cell !== undefined ? cell.toString() : '';
      maxLen = Math.max(maxLen, cellStr.length);
    }
    widths.push({ wch: Math.min(maxLen + padding, maxWidth) });
  }

  return widths;
};

/**
 * Auto-calculate column widths from an array of objects (json_to_sheet input)
 * @param {Array<Object>} jsonData - Array of row objects
 * @param {Array<string>} [headers] - Optional explicit header order
 * @param {number} [minWidth=8]
 * @param {number} [maxWidth=50]
 * @param {number} [padding=2]
 * @returns {Array<{wch: number}>}
 */
const autoFitColumnsFromJSON = (jsonData, headers, minWidth = 8, maxWidth = 50, padding = 2) => {
  if (!jsonData || jsonData.length === 0) return [];

  const keys = headers || Object.keys(jsonData[0]);
  const widths = [];

  keys.forEach(key => {
    let maxLen = key.toString().length; // start with header length
    jsonData.forEach(row => {
      const val = row[key];
      const valStr = val !== null && val !== undefined ? val.toString() : '';
      maxLen = Math.max(maxLen, valStr.length);
    });
    widths.push({ wch: Math.min(Math.max(maxLen + padding, minWidth), maxWidth) });
  });

  return widths;
};


/**
 * Read Excel file and convert to JSON
 * @param {File} file - Excel file
 * @returns {Promise<Array>} Array of objects
 */
export const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ''
        });

        // First row is header
        const headers = jsonData[0];
        const rows = jsonData.slice(1);

        // Convert to array of objects
        const result = rows
          .filter(row => row.some(cell => cell !== '')) // Remove empty rows
          .map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header.toString().trim()] = row[index]?.toString().trim() || '';
            });
            return obj;
          });

        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};


/**
 * Validate Excel data for student creation
 * @param {Array} data - Parsed Excel data
 * @returns {Object} { valid: boolean, errors: string[], data: Array }
 */
export const validateStudentExcelData = (data) => {
  const errors = [];
  const validData = [];

  const requiredColumns = ['ID', 'Password', 'Name', 'Gender'];

  if (data.length === 0) {
    return { valid: false, errors: ['Excel file is empty'], data: [] };
  }

  // Check if first row has required columns
  const firstRow = data[0];
  const missingColumns = requiredColumns.filter(col =>
    !Object.keys(firstRow).some(key =>
      key.toLowerCase() === col.toLowerCase()
    )
  );

  if (missingColumns.length > 0) {
    return {
      valid: false,
      errors: [`Missing columns: ${missingColumns.join(', ')}`],
      data: []
    };
  }

  // Validate each row
  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 because Excel rows start at 1 and header is row 1

    // Normalize keys to handle different cases
    const normalizedRow = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = requiredColumns.find(col =>
        col.toLowerCase() === key.toLowerCase()
      ) || key;
      normalizedRow[normalizedKey] = row[key];
    });

    // Check required fields
    if (!normalizedRow.ID) {
      errors.push(`Row ${rowNum}: ID is required`);
      return;
    }
    if (!normalizedRow.Password) {
      errors.push(`Row ${rowNum}: Password is required`);
      return;
    }
    if (!normalizedRow.Name) {
      errors.push(`Row ${rowNum}: Name is required`);
      return;
    }

    // Validate password length
    if (normalizedRow.Password.length < 6) {
      errors.push(`Row ${rowNum}: Password must be at least 6 characters`);
      return;
    }

    validData.push({
      id: normalizedRow.ID.toString(),
      password: normalizedRow.Password.toString(),
      name: normalizedRow.Name.toString(),
      gender: normalizedRow.Gender?.toString() || 'Not Specified'
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    data: validData
  };
};


/**
 * Create attendance Excel file
 * Generates 2 Sheets:
 * 1. Attendance Sheet (Matrix): ID, Name, [Dates...], Total Classes, Total Labs, Grand Total, Percentage
 * 2. Detailed: List of individual records sorted by Name (then Date)
 */
export const createAttendanceExcel = (attendanceData, subjectName, className, dateCapacities = {}) => {
  // --- STEP 1: Analyze Dates and Get Session Capacities from parameter ---

  // Get unique dates sorted
  const uniqueDates = [...new Set(attendanceData.map(a => a.date))].sort();

  // Use provided dateCapacities, or fall back to records if not provided
  let finalDateCapacities = { ...dateCapacities };

  // If dateCapacities not provided, try to infer from records (legacy fallback)
  if (Object.keys(finalDateCapacities).length === 0) {
    uniqueDates.forEach(date => {
      const recordsOnDate = attendanceData.filter(a => a.date === date);
      const maxCount = recordsOnDate.reduce((max, r) => Math.max(max, r.count || 1), 0);
      finalDateCapacities[date] = maxCount;
    });
  }

  // --- STEP 2: Prepare Student Data ---

  const studentMap = new Map();

  attendanceData.forEach(record => {
    if (!studentMap.has(record.oderId)) {
      studentMap.set(record.oderId, {
        id: record.studentId,
        name: record.studentName,
        records: {}, // Key: date, Value: { status, count, sessionType }
        totalAttended: 0,   // Sum of counts where present
        totalPossible: 0    // Sum of date capacities
      });
    }

    const student = studentMap.get(record.oderId);
    const count = record.count || 1;

    // Store record for the matrix view
    student.records[record.date] = {
      status: record.status,
      count: count,
      sessionType: record.sessionType
    };

    // Calculate Attended (Numerator)
    if (record.status === 'present') {
      student.totalAttended += count;
    }
  });

  // --- STEP 3: Calculate Total Possible (Denominator) per Student ---

  studentMap.forEach(student => {
    uniqueDates.forEach(date => {
      if (student.records[date]) {
        student.totalPossible += finalDateCapacities[date] || 1;
      }
    });
  });

  // --- STEP 4: BUILD SHEET 1 (ATTENDANCE MATRIX) ---

  // 1. Headers
  const matrixHeaders = ['ID', 'Name'];

  uniqueDates.forEach(date => {
    const record = attendanceData.find(a => a.date === date);
    let headerLabel = date;
    if (record) {
      if (record.sessionType === 'cumulative') {
        headerLabel = `${date} (${finalDateCapacities[date]})`;
      } else if (record.sessionType === 'lab') {
        headerLabel = `${date} (Lab)`;
      }
    }
    matrixHeaders.push(headerLabel);
  });

  // Add Summary Columns
  matrixHeaders.push('Total Attended', 'Grand Total', 'Percentage');

  // 2. Rows
  const matrixRows = [];
  const students = Array.from(studentMap.values());

  students.sort((a, b) => a.id.localeCompare(b.id));

  students.forEach(student => {
    const row = [student.id, student.name];

    // Fill Date Columns
    uniqueDates.forEach(date => {
      const rec = student.records[date];
      if (rec) {
        if (rec.status === 'absent') {
          row.push('0(Ab)');
        } else {
          row.push(rec.count.toString());
        }
      } else {
        row.push('-');
      }
    });

    // Fill Summary Columns
    row.push(student.totalAttended);
    row.push(student.totalPossible);

    const percentage = student.totalPossible > 0
      ? Math.round((student.totalAttended / student.totalPossible) * 100) + '%'
      : '0%';
    row.push(percentage);

    matrixRows.push(row);
  });

  // --- STEP 5: BUILD SHEET 2 (DETAILED) ---

  const detailedData = [];
  const sortedData = [...attendanceData].sort((a, b) => {
    const nameCompare = a.studentName.localeCompare(b.studentName);
    if (nameCompare !== 0) return nameCompare;
    return a.date.localeCompare(b.date);
  });

  sortedData.forEach(record => {
    detailedData.push({
      'ID': record.studentId,
      'Name': record.studentName,
      'Date': record.date,
      'Time': record.time || 'N/A',
      'Type': record.sessionType === 'lab' ? 'Lab' : (record.sessionType === 'cumulative' ? 'Manual' : 'Class'),
      'Status': record.status.charAt(0).toUpperCase() + record.status.slice(1)
    });
  });

  // --- STEP 6: CREATE WORKBOOK ---

  const workbook = XLSX.utils.book_new();

  // Sheet 1 — auto-fit columns
  const allMatrixAoa = [matrixHeaders, ...matrixRows];
  const matrixSheet = XLSX.utils.aoa_to_sheet(allMatrixAoa);
  matrixSheet['!cols'] = autoFitColumns(allMatrixAoa);
  XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Attendance Sheet');

  // Sheet 2 — auto-fit columns
  const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
  detailedSheet['!cols'] = autoFitColumnsFromJSON(detailedData);
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed');

  // Generate File
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const fileName = `Attendance_${subjectName}_${className}_${getTodayDate()}.xlsx`;
  saveAs(blob, fileName);

  return fileName;
};

/**
 * Create sample Excel template for student upload
 */
export const downloadSampleExcel = () => {
  const sampleData = [
    { ID: '22CS101', Password: 'pass123', Name: 'John Doe', Gender: 'Male' },
    { ID: '22CS102', Password: 'pass456', Name: 'Jane Smith', Gender: 'Female' },
    { ID: '22CS103', Password: 'pass789', Name: 'Bob Johnson', Gender: 'Male' },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Auto-fit columns
  worksheet['!cols'] = autoFitColumnsFromJSON(sampleData);

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  saveAs(blob, 'Student_Upload_Template.xlsx');
};


/**
 * Create Excel for Low Attendance Students
 */
export const createLowAttendanceExcel = (studentsData, className) => {
  const data = studentsData.map((s, idx) => ({
    'S.No': idx + 1,
    'ID': s.studentId,
    'Name': s.name,
    'Present': s.stats.present,
    'Absent': s.stats.absent,
    'Total': s.stats.total,
    'Percentage': s.stats.percentage + '%'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  // Auto-fit columns
  ws['!cols'] = autoFitColumnsFromJSON(data);

  XLSX.utils.book_append_sheet(wb, ws, 'Low Attendance');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const fileName = `Low_Attendance_${className}_${getTodayDate()}.xlsx`;
  saveAs(blob, fileName);

  return fileName;
};


/**
 * Create Activity Log Excel
 * Separate Sheet for each Class
 */
export const createActivityExcel = (logs, subjectName) => {
  if (logs.length === 0) return;

  const workbook = XLSX.utils.book_new();

  // Group by className
  const grouped = logs.reduce((acc, log) => {
    const cls = log.className || 'Unknown';
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(log);
    return acc;
  }, {});

  Object.keys(grouped).forEach(className => {
    let sheetName = className.replace(/[\\/?*[\]:]/g, '').substring(0, 31);

    const data = grouped[className].map(log => ({
      'Date': log.date,
      'Unit': log.unit || 'N/A',
      'Topic Covered': log.topic || 'N/A',
      'Logged At': log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit columns
    ws['!cols'] = autoFitColumnsFromJSON(data);

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `Activity_${subjectName}_${getTodayDate()}.xlsx`;
  saveAs(blob, fileName);

  return fileName;
};


/**
 * Create Global Low Attendance Excel
 * Sheet 1: Overall (All Students)
 * Subsequent Sheets: One per Class
 */
export const createGlobalLowAttendanceExcel = (students) => {
  if (students.length === 0) return;

  const workbook = XLSX.utils.book_new();

  // 1. Overall Sheet
  const overallData = students.map((s, idx) => ({
    'S.No': idx + 1,
    'Class': s.className,
    'ID': s.studentId,
    'Name': s.name,
    'Present': s.stats.present,
    'Absent': s.stats.absent,
    'Total': s.stats.total,
    'Percentage': s.stats.percentage + '%'
  }));

  const overallSheet = XLSX.utils.json_to_sheet(overallData);

  // Auto-fit columns
  overallSheet['!cols'] = autoFitColumnsFromJSON(overallData);

  XLSX.utils.book_append_sheet(workbook, overallSheet, 'Overall');

  // 2. Class-wise Sheets
  const grouped = students.reduce((acc, s) => {
    const cls = s.className || 'Unknown';
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(s);
    return acc;
  }, {});

  Object.keys(grouped).forEach(className => {
    let sheetName = className.replace(/[\\/?*[\]:]/g, '').substring(0, 31);

    const classData = grouped[className].map((s, idx) => ({
      'S.No': idx + 1,
      'ID': s.studentId,
      'Name': s.name,
      'Present': s.stats.present,
      'Absent': s.stats.absent,
      'Total': s.stats.total,
      'Percentage': s.stats.percentage + '%'
    }));

    const classSheet = XLSX.utils.json_to_sheet(classData);

    // Auto-fit columns
    classSheet['!cols'] = autoFitColumnsFromJSON(classData);

    XLSX.utils.book_append_sheet(workbook, classSheet, sheetName);
  });

  // Generate File
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `Global_Low_Attendance_${getTodayDate()}.xlsx`;
  saveAs(blob, fileName);

  return fileName;
};


export const createCRAttendanceExcel = (students, attendanceLogs) => {
  const dates = [...new Set(attendanceLogs.map(log => log.date))].sort();

  // Headers
  const headers = ['S.No', 'ID', 'Name', ...dates, 'Total Present', 'Total Days', 'Percentage'];

  const rows = students.map((student, index) => {
    const row = {
      'S.No': index + 1,
      'ID': student.studentId,
      'Name': student.name
    };

    let totalPresent = 0;
    const totalDays = dates.length;

    dates.forEach(date => {
      const log = attendanceLogs.find(l => l.date === date);
      const record = log?.records.find(r => r.studentId === student.id);
      const status = record ? (record.status === 'present' ? 'P' : 'A') : '-';
      row[date] = status;
      if (status === 'P') totalPresent++;
    });

    row['Total Present'] = totalPresent;
    row['Total Days'] = totalDays;
    row['Percentage'] = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) + '%' : '0%';

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Auto-fit columns
  ws['!cols'] = autoFitColumnsFromJSON(rows, headers);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CR_Attendance_Report.xlsx`);
};

export const downloadTeacherSampleExcel = () => {
  const sampleData = [
    { Name: 'Dr. Ramesh Kumar', Password: 'teacher123', Email: 'ramesh.kumar@rguktsklm.ac.in' },
    { Name: 'Priya Sharma', Password: 'teacher456', Email: 'priya.sharma@rguktsklm.ac.in' },
    { Name: 'Suresh Babu', Password: 'teacher789', Email: 'suresh.babu@rguktsklm.ac.in' },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = autoFitColumnsFromJSON(sampleData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'Teacher_Upload_Template.xlsx');
};


export const downloadSubjectSampleExcel = () => {
  const sampleData = [
    { Subject: 'CNS', 'Subject Code': '23CS3201', Teacher: 'Roopa M' },
    { Subject: 'CNS', 'Subject Code': '23CS3201', Teacher: 'Vishnu Priyanka J.' },
    { Subject: 'ML', 'Subject Code': '23CS3202', Teacher: 'Lakshmi Bala' },
    { Subject: 'ML', 'Subject Code': '23CS3202', Teacher: 'Anil Kumar T.' },
    { Subject: 'ELCS LAB', 'Subject Code': '23EG3283', Teacher: 'Ch Poli Raju' },
    { Subject: 'ELCS LAB', 'Subject Code': '23EG3283', Teacher: 'E. Raju' },
    { Subject: 'CDC', 'Subject Code': '23CS3203', Teacher: 'Radha Krishna' },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = autoFitColumnsFromJSON(sampleData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Subjects');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'Subject_Upload_Template.xlsx');
};

export default {
  readExcelFile,
  validateStudentExcelData,
  createAttendanceExcel,
  downloadSampleExcel,
  createLowAttendanceExcel,
  createGlobalLowAttendanceExcel,
  createActivityExcel,
  createCRAttendanceExcel,
  downloadTeacherSampleExcel,
  downloadSubjectSampleExcel
};

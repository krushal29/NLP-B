import express from 'express';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';

const router = express.Router();

// @desc    Record attendance (or update if already exists for the date)
// @route   POST /api/attendance
router.post('/', async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Date and records array are required' });
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate records
    if (records.length === 0) {
      return res.status(400).json({ message: 'Attendance records cannot be empty' });
    }

    for (const record of records) {
      if (!record.studentId || !record.status) {
        return res.status(400).json({ message: 'Each record must contain studentId and status (Present/Absent)' });
      }
      if (record.status !== 'Present' && record.status !== 'Absent') {
        return res.status(400).json({ message: 'Status must be either Present or Absent' });
      }
    }

    // Check if attendance already exists for this date
    let attendance = await Attendance.findOne({ date });

    if (attendance) {
      // If it already exists, update the records (Update attendance if already taken)
      attendance.records = records;
      const updatedAttendance = await attendance.save();
      return res.status(200).json({
        message: 'Attendance updated successfully for this date',
        attendance: updatedAttendance,
      });
    }

    // Otherwise, create a new record
    attendance = new Attendance({
      date,
      records,
    });

    const savedAttendance = await attendance.save();
    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance: savedAttendance,
    });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ message: 'Server error while saving attendance' });
  }
});

// @desc    Get all attendance dates with summary counts
// @route   GET /api/attendance
router.get('/', async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find({}).sort({ date: -1 });
    
    // Format response to include aggregates for list display
    const formattedRecords = attendanceRecords.map(record => {
      const presentCount = record.records.filter(r => r.status === 'Present').length;
      const absentCount = record.records.filter(r => r.status === 'Absent').length;
      return {
        _id: record._id,
        date: record.date,
        totalStudents: record.records.length,
        presentCount,
        absentCount,
      };
    });

    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Server error while fetching attendance records' });
  }
});

// @desc    Get attendance records for a specific date
// @route   GET /api/attendance/date/:date
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const attendance = await Attendance.findOne({ date }).populate('records.studentId');
    if (!attendance) {
      return res.status(404).json({ message: 'No attendance records found for this date', date });
    }

    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    res.status(500).json({ message: 'Server error while fetching attendance by date' });
  }
});

// @desc    Get attendance history & stats for a specific student
// @route   GET /api/attendance/student/:studentId
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find all attendance records containing this student
    const attendanceRecords = await Attendance.find({
      'records.studentId': studentId,
    }).sort({ date: -1 });

    let presentCount = 0;
    let absentCount = 0;
    const history = [];

    attendanceRecords.forEach((record) => {
      const match = record.records.find((r) => r.studentId.toString() === studentId);
      if (match) {
        if (match.status === 'Present') {
          presentCount++;
        } else {
          absentCount++;
        }
        history.push({
          date: record.date,
          status: match.status,
          attendanceId: record._id,
        });
      }
    });

    const totalDays = presentCount + absentCount;
    const attendancePercentage = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(2) : '0.00';

    res.status(200).json({
      student,
      stats: {
        totalDays,
        presentCount,
        absentCount,
        attendancePercentage: parseFloat(attendancePercentage),
      },
      history,
    });
  } catch (error) {
    console.error('Error fetching student attendance stats:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Student ID format' });
    }
    res.status(500).json({ message: 'Server error while fetching student attendance stats' });
  }
});

// @desc    Update attendance by record ID
// @route   PUT /api/attendance/:id
router.put('/:id', async (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Records array is required' });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Validate records
    for (const record of records) {
      if (!record.studentId || !record.status) {
        return res.status(400).json({ message: 'Each record must contain studentId and status (Present/Absent)' });
      }
      if (record.status !== 'Present' && record.status !== 'Absent') {
        return res.status(400).json({ message: 'Status must be either Present or Absent' });
      }
    }

    attendance.records = records;
    const updatedAttendance = await attendance.save();

    res.status(200).json({
      message: 'Attendance record updated successfully',
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error('Error updating attendance by ID:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Attendance ID format' });
    }
    res.status(500).json({ message: 'Server error while updating attendance record' });
  }
});

export default router;

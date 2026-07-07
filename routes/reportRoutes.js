import express from 'express';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// @desc    Generate attendance report PDF
// @route   GET /api/reports/attendance/pdf
router.get('/pdf', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate dates if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return res.status(400).json({ message: 'Invalid startDate format. Use YYYY-MM-DD' });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({ message: 'Invalid endDate format. Use YYYY-MM-DD' });
    }

    // Build date query
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = { date: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateQuery = { date: { $gte: startDate } };
    } else if (endDate) {
      dateQuery = { date: { $lte: endDate } };
    }

    // Fetch matching attendance documents
    const attendanceRecords = await Attendance.find(dateQuery).sort({ date: 1 });
    const totalDays = attendanceRecords.length;

    // Fetch all students
    const students = await Student.find({}).sort({ enrollmentNumber: 1 });

    // Calculate student attendance statistics in the date range
    const studentStats = students.map((student) => {
      let presentCount = 0;
      let absentCount = 0;

      attendanceRecords.forEach((record) => {
        const match = record.records.find((r) => r.studentId.toString() === student._id.toString());
        if (match) {
          if (match.status === 'Present') {
            presentCount++;
          } else {
            absentCount++;
          }
        }
      });

      const studentDays = presentCount + absentCount;
      const percentage = studentDays > 0 ? ((presentCount / studentDays) * 100).toFixed(1) : '0.0';

      return {
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        className: student.className,
        semester: student.semester,
        presentCount,
        absentCount,
        percentage: parseFloat(percentage),
      };
    });

    // Create PDF Document
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Set response headers to stream PDF
    const filename = `Attendance_Report_${startDate || 'all'}_to_${endDate || 'all'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header styling
    doc.fillColor('#0F172A').rect(0, 0, 595, 80).fill();

    doc.fillColor('#FFFFFF')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('ATTENDANCE MANAGEMENT SYSTEM', 30, 20);

    doc.fontSize(11)
      .font('Helvetica')
      .fillColor('#94A3B8')
      .text('Generated Attendance Summary Report', 30, 48);

    // Document Info section
    doc.fillColor('#0F172A')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('REPORT DETAILS', 30, 100);

    doc.moveTo(30, 115).lineTo(565, 115).strokeColor('#E2E8F0').lineWidth(1).stroke();

    const rangeStr = startDate && endDate
      ? `${startDate} to ${endDate}`
      : (startDate ? `From ${startDate}` : (endDate ? `Up to ${endDate}` : 'All Time'));

    // Meta columns
    doc.fontSize(10).font('Helvetica-Bold').text('Date Range:', 30, 125);
    doc.font('Helvetica').text(rangeStr, 110, 125);

    doc.font('Helvetica-Bold').text('Total Classes:', 300, 125);
    doc.font('Helvetica').text(totalDays.toString(), 390, 125);

    doc.font('Helvetica-Bold').text('Total Students:', 300, 140);
    doc.font('Helvetica').text(students.length.toString(), 390, 140);

    doc.font('Helvetica-Bold').text('Generated On:', 30, 140);
    doc.font('Helvetica').text(new Date().toLocaleDateString(), 110, 140);

    doc.moveTo(30, 160).lineTo(565, 160).strokeColor('#E2E8F0').stroke();

    // Table Header
    const tableTop = 180;
    const itemHeight = 22;

    doc.fillColor('#4F46E5').rect(30, tableTop, 535, 25).fill();

    doc.fillColor('#FFFFFF')
      .fontSize(9)
      .font('Helvetica-Bold');

    doc.text('Enrollment No', 35, tableTop + 8, { width: 90 });
    doc.text('Student Name', 130, tableTop + 8, { width: 140 });
    doc.text('Class/Sem', 280, tableTop + 8, { width: 90 });
    doc.text('Present', 380, tableTop + 8, { width: 45, align: 'center' });
    doc.text('Absent', 435, tableTop + 8, { width: 45, align: 'center' });
    doc.text('Percentage', 490, tableTop + 8, { width: 70, align: 'center' });

    let currentY = tableTop + 25;

    // Draw students rows
    studentStats.forEach((stat, index) => {
      // Handle page break
      if (currentY > 750) {
        doc.addPage();
        // Redraw Header on new page
        doc.fillColor('#4F46E5').rect(30, 30, 535, 25).fill();
        doc.fillColor('#FFFFFF')
          .fontSize(9)
          .font('Helvetica-Bold');
        doc.text('Enrollment No', 35, 38, { width: 90 });
        doc.text('Student Name', 130, 38, { width: 140 });
        doc.text('Class/Sem', 280, 38, { width: 90 });
        doc.text('Present', 380, 38, { width: 45, align: 'center' });
        doc.text('Absent', 435, 38, { width: 45, align: 'center' });
        doc.text('Percentage', 490, 38, { width: 70, align: 'center' });
        currentY = 55;
      }

      // Zebra striping
      if (index % 2 === 0) {
        doc.fillColor('#F8FAFC').rect(30, currentY, 535, itemHeight).fill();
      }

      // Grid line
      doc.moveTo(30, currentY + itemHeight).lineTo(565, currentY + itemHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

      // Row Text
      doc.fillColor('#0F172A').font('Helvetica').fontSize(9);
      doc.text(stat.enrollmentNumber, 35, currentY + 7, { width: 90, ellipsis: true });
      doc.text(stat.name, 130, currentY + 7, { width: 140, ellipsis: true });
      doc.text(`${stat.className} / Sem ${stat.semester}`, 280, currentY + 7, { width: 90, ellipsis: true });
      doc.text(stat.presentCount.toString(), 380, currentY + 7, { width: 45, align: 'center' });
      doc.text(stat.absentCount.toString(), 435, currentY + 7, { width: 45, align: 'center' });

      // Highlight low attendance (under 75%) in red, good in green
      const color = stat.percentage < 75 ? '#EF4444' : '#10B981';
      doc.fillColor(color).font('Helvetica-Bold');
      doc.text(`${stat.percentage}%`, 490, currentY + 7, { width: 70, align: 'center' });

      currentY += itemHeight;
    });

    // End Document
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ message: 'Server error while generating PDF report' });
  }
});

export default router;

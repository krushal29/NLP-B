import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import PDFDocument from 'pdfkit';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_db';

async function runTests() {
  console.log('--- STARTING BACKEND INTEGRATION TEST ---');
  console.log(`Connecting to: ${connStr}`);

  try {
    await mongoose.connect(connStr);
    console.log('Connected to Database successfully!');

    // Cleanup previous test data if any
    await Student.deleteMany({ enrollmentNumber: { $in: ['TEST-001', 'TEST-002'] } });
    await Attendance.deleteMany({ date: '2026-07-07' });
    console.log('Cleaned up prior test data.');

    // 1. Create Students
    console.log('\n--- 1. Testing Student Creation ---');
    const student1 = await Student.create({
      name: 'John Doe Test',
      enrollmentNumber: 'TEST-001',
      className: 'Computer Science',
      semester: '6',
    });
    console.log('Created Student 1:', student1.name, `(${student1.enrollmentNumber})`);

    const student2 = await Student.create({
      name: 'Jane Smith Test',
      enrollmentNumber: 'TEST-002',
      className: 'Computer Science',
      semester: '6',
    });
    console.log('Created Student 2:', student2.name, `(${student2.enrollmentNumber})`);

    // Verify duplicate validation
    try {
      await Student.create({
        name: 'Duplicate Enrollment Test',
        enrollmentNumber: 'TEST-001',
        className: 'Info Tech',
        semester: '4',
      });
      console.error('FAIL: Allowed duplicate enrollment numbers!');
      process.exit(1);
    } catch (err) {
      console.log('PASS: Successfully blocked duplicate enrollment number.');
    }

    // 2. Fetch Student List
    console.log('\n--- 2. Testing Student Read ---');
    const students = await Student.find({ enrollmentNumber: { $in: ['TEST-001', 'TEST-002'] } });
    if (students.length === 2) {
      console.log('PASS: Retreived both test students.');
    } else {
      console.error(`FAIL: Expected 2 students, got ${students.length}`);
      process.exit(1);
    }

    // 3. Update Student details
    console.log('\n--- 3. Testing Student Update ---');
    student1.name = 'Johnathan Doe Test';
    await student1.save();
    const updatedSt1 = await Student.findById(student1._id);
    if (updatedSt1.name === 'Johnathan Doe Test') {
      console.log('PASS: Successfully updated student details.');
    } else {
      console.error('FAIL: Student details did not update!');
      process.exit(1);
    }

    // 4. Mark Attendance
    console.log('\n--- 4. Testing Attendance Creation (Mark Attendance) ---');
    const dateStr = '2026-07-07';
    const records = [
      { studentId: student1._id, status: 'Present' },
      { studentId: student2._id, status: 'Absent' },
    ];

    const attendance = await Attendance.create({
      date: dateStr,
      records: records,
    });
    console.log(`PASS: Recorded attendance for ${dateStr} successfully.`);

    // Verify unique date constraint
    try {
      await Attendance.create({
        date: dateStr,
        records: records,
      });
      console.error('FAIL: Allowed duplicate attendance date!');
      process.exit(1);
    } catch (err) {
      console.log('PASS: Correctly blocked duplicate date.');
    }

    // 5. Update Attendance (Mark Attendance on same date again)
    console.log('\n--- 5. Testing Attendance Update ---');
    // Change Jane Smith (student2) to Present
    const recordToUpdate = await Attendance.findOne({ date: dateStr });
    recordToUpdate.records = [
      { studentId: student1._id, status: 'Present' },
      { studentId: student2._id, status: 'Present' }, // Changed to Present
    ];
    await recordToUpdate.save();

    const updatedAtt = await Attendance.findOne({ date: dateStr });
    const student2Status = updatedAtt.records.find(
      (r) => r.studentId.toString() === student2._id.toString()
    ).status;

    if (student2Status === 'Present') {
      console.log('PASS: Successfully updated attendance record.');
    } else {
      console.error('FAIL: Attendance status did not update!');
      process.exit(1);
    }

    // 6. Test Stats Aggregation (Student Details API simulation)
    console.log('\n--- 6. Testing Student Stats Aggregation ---');
    const student1Stats = await Attendance.find({ 'records.studentId': student1._id });
    let present = 0;
    let absent = 0;
    student1Stats.forEach((att) => {
      const rec = att.records.find((r) => r.studentId.toString() === student1._id.toString());
      if (rec.status === 'Present') present++;
      else absent++;
    });
    console.log(`Student 1: Present=${present}, Absent=${absent}, Total=${present + absent}`);
    if (present === 1 && absent === 0) {
      console.log('PASS: Student stats match expectation.');
    } else {
      console.error(`FAIL: Student stats mismatch! Expected Present=1, got ${present}`);
      process.exit(1);
    }

    // 7. Test PDF Generation (Local Write test)
    console.log('\n--- 7. Testing PDF Generation (Local Write) ---');
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const testPdfPath = './test-report.pdf';
    const stream = fs.createWriteStream(testPdfPath);
    doc.pipe(stream);
    doc.text('TEST ATTENDANCE REPORT PDF');
    doc.text(`Student: ${student1.name} - Present: ${present}, Absent: ${absent}`);
    doc.end();

    await new Promise((resolve) => stream.on('finish', resolve));
    if (fs.existsSync(testPdfPath)) {
      console.log(`PASS: PDF file successfully written to ${testPdfPath}`);
      fs.unlinkSync(testPdfPath); // Delete test file
      console.log('Removed temporary test PDF file.');
    } else {
      console.error('FAIL: PDF generation failed to write file!');
      process.exit(1);
    }

    // 8. Cleanup and Delete Students
    console.log('\n--- 8. Testing Student & Attendance Cleanup ---');
    await Student.findByIdAndDelete(student1._id);
    await Student.findByIdAndDelete(student2._id);
    await Attendance.deleteOne({ date: dateStr });
    console.log('PASS: Cleaned up database entries.');

    console.log('\n======================================');
    console.log('ALL BACKEND API AND MODEL TESTS PASSED!');
    console.log('======================================');
  } catch (error) {
    console.error('TESTING ERROR:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTests();

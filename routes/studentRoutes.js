import express from 'express';
import Student from '../models/Student.js';

const router = express.Router();

// @desc    Create a new student
// @route   POST /api/students
router.post('/', async (req, res) => {
  try {
    const { name, enrollmentNumber, className, semester } = req.body;

    if (!name || !enrollmentNumber || !className || !semester) {
      return res.status(400).json({ message: 'All fields (name, enrollmentNumber, className, semester) are required' });
    }

    // Check if enrollment number already exists
    const studentExists = await Student.findOne({ enrollmentNumber: enrollmentNumber.trim() });
    if (studentExists) {
      return res.status(400).json({ message: 'A student with this enrollment number already exists' });
    }

    const student = new Student({
      name: name.trim(),
      enrollmentNumber: enrollmentNumber.trim(),
      className: className.trim(),
      semester: semester.trim(),
    });

    const savedStudent = await student.save();
    res.status(201).json(savedStudent);
  } catch (error) {
    console.error('Error creating student:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error while creating student' });
  }
});

// @desc    Get all students
// @route   GET /api/students
router.get('/', async (req, res) => {
  try {
    const students = await Student.find({}).sort({ enrollmentNumber: 1 });
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error while fetching students' });
  }
});

// @desc    Get a student by ID
// @route   GET /api/students/:id
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json(student);
  } catch (error) {
    console.error('Error fetching student details:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Student ID format' });
    }
    res.status(500).json({ message: 'Server error while fetching student details' });
  }
});

// @desc    Update a student
// @route   PUT /api/students/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, enrollmentNumber, className, semester } = req.body;

    if (!name || !enrollmentNumber || !className || !semester) {
      return res.status(400).json({ message: 'All fields (name, enrollmentNumber, className, semester) are required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if new enrollment number already exists on another student
    if (enrollmentNumber.trim() !== student.enrollmentNumber) {
      const enrollmentExists = await Student.findOne({ enrollmentNumber: enrollmentNumber.trim() });
      if (enrollmentExists) {
        return res.status(400).json({ message: 'Another student with this enrollment number already exists' });
      }
    }

    student.name = name.trim();
    student.enrollmentNumber = enrollmentNumber.trim();
    student.className = className.trim();
    student.semester = semester.trim();

    const updatedStudent = await student.save();
    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error('Error updating student:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error while updating student' });
  }
});

// @desc    Delete a student
// @route   DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Student ID format' });
    }
    res.status(500).json({ message: 'Server error while deleting student' });
  }
});

export default router;

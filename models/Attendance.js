import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required for attendance status'],
  },
  status: {
    type: String,
    enum: {
      values: ['Present', 'Absent'],
      message: 'Status must be either Present or Absent',
    },
    required: [true, 'Attendance status is required'],
  },
});

const attendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: [true, 'Attendance date is required'],
      unique: true,
      trim: true,
    },
    records: [recordSchema],
  },
  {
    timestamps: true,
  }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;

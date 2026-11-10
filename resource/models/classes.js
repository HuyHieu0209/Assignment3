const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: { type: String, default: 'enrolled' },
}, { _id: false });

const classSchema = new mongoose.Schema({
    className: { type: String, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    lecturerName: { type: String },
    status: { type: String },
    enrollments: [enrollmentSchema],
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Class', classSchema);

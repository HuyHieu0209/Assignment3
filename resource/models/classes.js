const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: { type: String, enum: ['ENROLLED', 'DROPPED'], default: 'ENROLLED' },
}, { _id: false });

const classSchema = new mongoose.Schema({
    classCode: { type: String, required: true, unique: true },
    className: { type: String, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    enrollments: [enrollmentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentCode: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Student', studentSchema);

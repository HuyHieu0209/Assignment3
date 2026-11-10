const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    status: { type: String },
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Subject', subjectSchema);

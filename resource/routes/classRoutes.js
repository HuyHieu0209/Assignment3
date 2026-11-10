const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    getStudentsByClass,
    getAttendanceSummary,
    upsertAttendances,
} = require('../controller/attendencesController');

// GET /api/classes/:classId/students  (protected)
router.get('/:classId/students', verifyToken, getStudentsByClass);

// GET /api/classes/:classId/attendance-summary  (protected)
router.get('/:classId/attendance-summary', verifyToken, getAttendanceSummary);

// POST /api/classes/:classId/attendances
router.post('/:classId/attendances', upsertAttendances);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getAttendanceByStudent } = require('../controller/attendencesController');

// GET /api/students/:studentId/attendances  (protected)
router.get('/:studentId/attendances', verifyToken, getAttendanceByStudent);

module.exports = router;

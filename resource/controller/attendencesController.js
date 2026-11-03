const mongoose = require('mongoose');
const Class = require('../models/classes');
const Attendance = require('../models/attendences');
const Student = require('../models/students');

// GET /api/classes/:classId/students?status=enrolled
const getStudentsByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const { status } = req.query;

        // Validate classId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({ message: 'Invalid classId. Must be a valid ObjectId.' });
        }

        // Check class exists
        const classDoc = await Class.findById(classId).populate('enrollments.studentId', 'studentId name email');
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found.' });
        }

        // Validate status query param (default: ENROLLED)
        const validStatuses = ['ENROLLED', 'DROPPED'];
        const requestedStatus = status ? status.toUpperCase() : 'ENROLLED';

        if (!validStatuses.includes(requestedStatus)) {
            return res.status(400).json({ message: 'Invalid status. Accepted values: enrolled, dropped.' });
        }

        // Filter enrollments by status
        const filtered = classDoc.enrollments
            .filter(e => e.status === requestedStatus)
            .map(e => {
                const s = e.studentId;
                return {
                    studentId: s._id,
                    studentCode: s.studentId,
                    fullName: s.name,
                    email: s.email,
                };
            });

        return res.status(200).json({
            classCode: classDoc.classCode,
            className: classDoc.className,
            status: requestedStatus,
            total: filtered.length,
            students: filtered,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// GET /api/classes/:classId/attendance-summary
const getAttendanceSummary = async (req, res) => {
    try {
        const { classId } = req.params;

        // Validate classId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({ message: 'Invalid classId. Must be a valid ObjectId.' });
        }

        // Check class exists
        const classDoc = await Class.findById(classId).populate('enrollments.studentId', 'studentId name email');
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found.' });
        }

        // Only enrolled students
        const enrolledStudents = classDoc.enrollments.filter(e => e.status === 'ENROLLED');

        const summary = await Promise.all(
            enrolledStudents.map(async (enrollment) => {
                const student = enrollment.studentId;

                const records = await Attendance.find({
                    studentId: student._id,
                    classId: classId,
                });

                const totalSessions = records.length;
                const present = records.filter(r => r.status === 'PRESENT').length;
                const absent = records.filter(r => r.status === 'ABSENT').length;

                // attendanceRate = present / totalSessions * 100, rounded to 1 decimal
                const attendanceRate = totalSessions > 0
                    ? Math.round((present / totalSessions) * 1000) / 10
                    : 0;

                // warning = true if attendanceRate < 80% (includes 0 sessions)
                const warning = attendanceRate < 80;

                return {
                    student: {
                        studentId: student._id,
                        studentCode: student.studentId,
                        fullName: student.name,
                        email: student.email,
                    },
                    totalSessions,
                    present,
                    absent,
                    attendanceRate,
                    warning,
                };
            })
        );

        return res.status(200).json({
            classCode: classDoc.classCode,
            className: classDoc.className,
            totalEnrolled: enrolledStudents.length,
            summary,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// GET /api/students/:studentId/attendances
const getAttendanceByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Validate studentId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId. Must be a valid ObjectId.' });
        }

        // Find student by MongoDB _id
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const records = await Attendance.find({ studentId })
            .populate('classId', 'classCode className')
            .sort({ date: -1 });

        return res.status(200).json({
            student: {
                studentId: student._id,
                studentCode: student.studentId,
                fullName: student.name,
                email: student.email,
            },
            total: records.length,
            attendances: records,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { getStudentsByClass, getAttendanceSummary, getAttendanceByStudent };

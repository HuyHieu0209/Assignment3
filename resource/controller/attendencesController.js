const mongoose = require("mongoose");
const Class = require("../models/classes");
const Attendance = require("../models/attendences");
const Student = require("../models/students");
const Subject = require("../models/subjects");

// ─────────────────────────────────────────────────────────────
// Requirement 2: GET /api/classes/:classId/students?status=enrolled
// ─────────────────────────────────────────────────────────────
const getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status } = req.query;

    // Validate classId. If classId is not a valid ObjectId, return HTTP 400
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res
        .status(400)
        .json({ message: "Invalid classId. Must be a valid ObjectId." });
    }

    const classDoc = await Class.findById(classId).populate(
      "enrollments.studentId",
      "studentCode fullName email",
    );
    if (!classDoc) {
      return res.status(404).json({ message: "Class not found." });
    }

    // Validate status query param (optional, default: enrolled, case-insensitive)
    const validStatuses = ["ENROLLED", "DROPPED"];
    const requestedStatus = status ? status.toUpperCase() : "ENROLLED";
    if (!validStatuses.includes(requestedStatus)) {
      return res
        .status(400)
        .json({
          message: "Invalid status. Accepted values: enrolled, dropped.",
        });
    }

    const students = classDoc.enrollments
      .filter((e) => e.status && e.status.toUpperCase() === requestedStatus)
      .map((e) => {
        const s = e.studentId;
        return {
          studentId: s._id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          email: s.email,
        };
      });

    return res.status(200).json(students);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Requirement 3: GET /api/classes/:classId/attendance-summary
// ─────────────────────────────────────────────────────────────
const getAttendanceSummary = async (req, res) => {
  try {
    const { classId } = req.params;

    // Validate classId and check whether class exists (return 400 if invalid ObjectId, 404 if not found)
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res
        .status(400)
        .json({ message: "Invalid classId. Must be a valid ObjectId." });
    }

    const classDoc = await Class.findById(classId).populate(
      "enrollments.studentId",
      "studentCode fullName email",
    );
    if (!classDoc) {
      return res.status(404).json({ message: "Class not found." });
    }

    // Calculate attendance statistics only for students whose enrollment status is ENROLLED
    const enrolledStudents = classDoc.enrollments.filter(
      (e) => e.status && e.status.toUpperCase() === "ENROLLED",
    );

    const summary = await Promise.all(
      enrolledStudents.map(async (enrollment) => {
        const student = enrollment.studentId;

        const records = await Attendance.find({
          studentId: student._id,
          classId: classId,
        });

        const totalSessions = records.length;
        const present = records.filter((r) => r.status === "PRESENT").length;
        const absent = records.filter((r) => r.status === "ABSENT").length;

        // attendanceRate: present / totalSessions * 100, round to 1 decimal place
        const attendanceRate =
          totalSessions > 0
            ? Math.round((present / totalSessions) * 1000) / 10
            : 0;

        // warning: true if attendanceRate < 80%, otherwise false
        const warning = attendanceRate < 80;

        return {
          studentId: student._id,
          studentCode: student.studentCode,
          fullName: student.fullName,
          email: student.email,
          totalSessions,
          present,
          absent,
          attendanceRate,
          warning,
        };
      }),
    );

    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Requirement 4: GET /api/students/:studentId/attendances
// ─────────────────────────────────────────────────────────────
const getAttendanceByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate studentId. If studentId is not a valid ObjectId, return HTTP 400
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res
        .status(400)
        .json({ message: "Invalid studentId. Must be a valid ObjectId." });
    }

    // If the corresponding student does not exist, return HTTP 404
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Return all attendance records belonging to the student across all classes
    // Each attendance record must include fields: className, subjectName, date, status
    // Sort the records by date in descending order (newest records first)
    const records = await Attendance.find({ studentId })
      .populate({
        path: "classId",
        select: "className subjectId",
        populate: {
          path: "subjectId",
          select: "name subjectName",
        },
      })
      .sort({ date: -1 });

    const attendances = records.map((r) => ({
      className: r.classId?.className || null,
      subjectName:
        r.classId?.subjectId?.name || r.classId?.subjectId?.subjectName || null,
      date: r.date,
      status: r.status,
    }));

    // If the student has no attendance records, return an empty array
    return res.status(200).json(attendances);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStudentsByClass,
  getAttendanceSummary,
  getAttendanceByStudent,
  upsertAttendances,
};

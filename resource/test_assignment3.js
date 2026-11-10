const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// We will test using express app directly with supertest or node http
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);

async function runTests() {
    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${msg}`);
            failed++;
        }
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB:', process.env.MONGO_URI);

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(method, path, body = null, headers = {}) {
        const url = `${baseUrl}${path}`;
        const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = null;
        }
        return { status: res.status, body: data };
    }

    console.log('\n--- TESTING REQUIREMENT 1: LOGIN & JWT AUTHENTICATION ---');
    // 1.1 Missing fields
    let r = await req('POST', '/api/auth/login', { email: 'anvn@fpt.edu.vn' });
    assert(r.status === 401, 'POST /api/auth/login missing password returns 401');

    r = await req('POST', '/api/auth/login', { password: 'masv@123' });
    assert(r.status === 401, 'POST /api/auth/login missing email returns 401');

    // 1.2 Invalid credentials
    r = await req('POST', '/api/auth/login', { email: 'nonexistent@fpt.edu.vn', password: 'masv@123' });
    assert(r.status === 401, 'POST /api/auth/login nonexistent email returns 401');

    r = await req('POST', '/api/auth/login', { email: 'anvn@fpt.edu.vn', password: 'wrongpassword' });
    assert(r.status === 401, 'POST /api/auth/login wrong password returns 401');

    // 1.3 Successful login with test password
    r = await req('POST', '/api/auth/login', { email: 'anvn@fpt.edu.vn', password: 'masv@123' });
    assert(r.status === 200, 'POST /api/auth/login successful returns 200');
    assert(r.body && r.body.token, 'Response contains token');
    assert(r.body && r.body.message === 'Login successful', 'Response message is "Login successful"');

    const token = r.body?.token;
    const decoded = jwt.decode(token);
    assert(decoded && decoded.studentId, 'JWT payload contains studentId');
    assert(decoded && decoded.exp - decoded.iat === 3600, 'JWT expires in 1 hour (3600s)');

    // 1.4 Test login with specific student account he187023@fpt.edu.vn / he187023@123
    r = await req('POST', '/api/auth/login', { email: 'he187023@fpt.edu.vn', password: 'he187023@123' });
    assert(r.status === 200, 'POST /api/auth/login with he187023@fpt.edu.vn and he187023@123 returns 200');
    assert(r.body && r.body.token, 'he187023 login returns valid token');

    // 1.5 Also test login with studentCode password
    r = await req('POST', '/api/auth/login', { email: 'anvn@fpt.edu.vn', password: 'SE001@123' });
    assert(r.status === 200, 'POST /api/auth/login with SE001@123 returns 200');

    // 1.5 verifyToken middleware protection
    r = await req('GET', '/api/classes/65bb00000000000000000001/students');
    assert(r.status === 401, 'Request without Authorization header returns 401');

    r = await req('GET', '/api/classes/65bb00000000000000000001/students', null, { Authorization: 'Basic xyz' });
    assert(r.status === 401, 'Request with invalid Bearer format returns 401');

    r = await req('GET', '/api/classes/65bb00000000000000000001/students', null, { Authorization: 'Bearer invalid.token.here' });
    assert(r.status === 401, 'Request with invalid token returns 401');

    const authHeaders = { Authorization: `Bearer ${token}` };

    console.log('\n--- TESTING REQUIREMENT 2: GET STUDENTS IN A CLASS ---');
    // 2.1 Validate classId
    r = await req('GET', '/api/classes/invalid-id/students', null, authHeaders);
    assert(r.status === 400, 'Invalid classId returns 400');

    r = await req('GET', '/api/classes/65bb00000000000000000099/students', null, authHeaders);
    assert(r.status === 404, 'Non-existent classId returns 404');

    // 2.2 Invalid status param
    r = await req('GET', '/api/classes/65bb00000000000000000001/students?status=active', null, authHeaders);
    assert(r.status === 400, 'Invalid status parameter returns 400');

    // 2.3 Get enrolled students (default status)
    r = await req('GET', '/api/classes/65bb00000000000000000001/students', null, authHeaders);
    assert(r.status === 200, 'GET /api/classes/:classId/students returns 200');
    let list = Array.isArray(r.body) ? r.body : r.body?.students;
    assert(Array.isArray(list) && list.length === 3, 'SE1701 has 3 enrolled students (SE001, SE002, SE003)');
    const codes = list.map(s => s.studentCode).sort();
    assert(JSON.stringify(codes) === JSON.stringify(['SE001', 'SE002', 'SE003']), 'Student codes match SE001, SE002, SE003');
    assert(list[0].studentId && list[0].fullName && list[0].email, 'Student contains studentId, fullName, email');

    // 2.4 Get dropped students (case-insensitive)
    r = await req('GET', '/api/classes/65bb00000000000000000001/students?status=DROPPED', null, authHeaders);
    list = Array.isArray(r.body) ? r.body : r.body?.students;
    assert(r.status === 200 && list.length === 1 && list[0].studentCode === 'SE004', 'DROPPED query returns 1 dropped student SE004');

    console.log('\n--- TESTING REQUIREMENT 3: ATTENDANCE SUMMARY OF A CLASS ---');
    // 3.1 Validate classId
    r = await req('GET', '/api/classes/invalid-id/attendance-summary', null, authHeaders);
    assert(r.status === 400, 'Invalid classId returns 400');

    r = await req('GET', '/api/classes/65bb00000000000000000099/attendance-summary', null, authHeaders);
    assert(r.status === 404, 'Non-existent classId returns 404');

    // 3.2 Attendance summary for SE1701
    r = await req('GET', '/api/classes/65bb00000000000000000001/attendance-summary', null, authHeaders);
    assert(r.status === 200, 'GET /api/classes/:classId/attendance-summary returns 200');
    let summary = Array.isArray(r.body) ? r.body : r.body?.summary;
    assert(Array.isArray(summary) && summary.length === 3, 'Summary contains 3 enrolled students');

    const s1 = summary.find(s => (s.studentCode || s.student?.studentCode) === 'SE001');
    const s2 = summary.find(s => (s.studentCode || s.student?.studentCode) === 'SE002');
    const s3 = summary.find(s => (s.studentCode || s.student?.studentCode) === 'SE003');

    assert(s1 && s1.totalSessions === 10 && s1.present === 9 && s1.absent === 1 && s1.attendanceRate === 90 && s1.warning === false,
        'SE001 summary: 10 sessions, 9 present, 1 absent, 90.0%, warning=false');
    assert(s2 && s2.totalSessions === 10 && s2.present === 7 && s2.absent === 3 && s2.attendanceRate === 70 && s2.warning === true,
        'SE002 summary: 10 sessions, 7 present, 3 absent, 70.0%, warning=true');
    assert(s3 && s3.totalSessions === 10 && s3.present === 6 && s3.absent === 4 && s3.attendanceRate === 60 && s3.warning === true,
        'SE003 summary: 10 sessions, 6 present, 4 absent, 60.0%, warning=true');

    console.log('\n--- TESTING REQUIREMENT 4: ATTENDANCE HISTORY OF A STUDENT ---');
    // 4.1 Validate studentId
    r = await req('GET', '/api/students/invalid-id/attendances', null, authHeaders);
    assert(r.status === 400, 'Invalid studentId returns 400');

    r = await req('GET', '/api/students/65dd00000000000000000099/attendances', null, authHeaders);
    assert(r.status === 404, 'Non-existent studentId returns 404');

    // 4.2 Attendance history for student SE001
    r = await req('GET', '/api/students/65dd00000000000000000001/attendances', null, authHeaders);
    assert(r.status === 200, 'GET /api/students/:studentId/attendances returns 200');
    let attendances = Array.isArray(r.body) ? r.body : r.body?.attendances;
    assert(Array.isArray(attendances) && attendances.length === 19, 'SE001 has 19 total attendance records across all classes');
    assert(attendances[0].className && attendances[0].subjectName && attendances[0].date && attendances[0].status,
        'Record includes className, subjectName, date, status');
    assert(attendances[0].subjectName !== null, `subjectName is not null (value: "${attendances[0].subjectName}")`);

    // Verify sort date descending
    let isSorted = true;
    for (let i = 0; i < attendances.length - 1; i++) {
        if (new Date(attendances[i].date) < new Date(attendances[i + 1].date)) {
            isSorted = false;
            break;
        }
    }
    assert(isSorted, 'Records are sorted by date descending (newest first)');

    console.log('\n--- TESTING REQUIREMENT 5: UPSERT MULTIPLE ATTENDANCES ---');
    // 5.1 Validation: classId
    r = await req('POST', '/api/classes/invalid-id/attendances', { date: '2026-03-17', records: [] });
    assert(r.status === 400, 'Invalid classId returns 400');

    r = await req('POST', '/api/classes/65bb00000000000000000099/attendances', { date: '2026-03-17', records: [] });
    assert(r.status === 404, 'Non-existent class returns 404');

    // 5.2 Validation: date required, valid, not in future
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', { records: [] });
    assert(r.status === 400, 'Missing date returns 400');

    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', { date: 'invalid-date', records: [] });
    assert(r.status === 400, 'Invalid date returns 400');

    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', { date: '2099-01-01', records: [] });
    assert(r.status === 400, 'Future date returns 400');

    // 5.3 Validation: records array non-empty
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', { date: '2026-03-17', records: [] });
    assert(r.status === 400, 'Empty records array returns 400');

    // 5.4 Validation: student not enrolled (e.g. SE004 is DROPPED in SE1701)
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', {
        date: '2026-03-17',
        records: [
            { studentId: '65dd00000000000000000004', status: 'PRESENT' }
        ]
    });
    assert(r.status === 400, 'Dropped student in records returns 400');

    // 5.5 Validation: missing enrolled students (only 2 of 3 provided)
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', {
        date: '2026-03-17',
        records: [
            { studentId: '65dd00000000000000000001', status: 'PRESENT' },
            { studentId: '65dd00000000000000000002', status: 'ABSENT' }
        ]
    });
    assert(r.status === 400, 'Missing enrolled students returns 400');

    // 5.6 Validation: invalid status
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', {
        date: '2026-03-17',
        records: [
            { studentId: '65dd00000000000000000001', status: 'PRESENT' },
            { studentId: '65dd00000000000000000002', status: 'INVALID' },
            { studentId: '65dd00000000000000000003', status: 'ABSENT' }
        ]
    });
    assert(r.status === 400, 'Invalid status returns 400');

    // 5.7 Successful upsert: Insert new date
    const testDate = '2026-03-17';
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', {
        date: testDate,
        records: [
            { studentId: '65dd00000000000000000001', status: 'PRESENT' },
            { studentId: '65dd00000000000000000002', status: 'ABSENT' },
            { studentId: '65dd00000000000000000003', status: 'PRESENT' }
        ]
    });
    assert(r.status === 200, 'Valid upsert returns 200');
    assert(r.body && r.body.total === 3, 'Total upserted records is 3');

    // 5.8 Upsert update: Send same date, update status for SE002 to PRESENT
    r = await req('POST', '/api/classes/65bb00000000000000000001/attendances', {
        date: testDate,
        records: [
            { studentId: '65dd00000000000000000001', status: 'PRESENT' },
            { studentId: '65dd00000000000000000002', status: 'PRESENT' },
            { studentId: '65dd00000000000000000003', status: 'ABSENT' }
        ]
    });
    assert(r.status === 200, 'Second upsert on same date returns 200');

    // Check attendance in DB to ensure it was updated and not duplicated
    const Attendance = require('./models/attendences');
    const savedRecords = await Attendance.find({
        classId: '65bb00000000000000000001',
        date: new Date(Date.UTC(2026, 2, 17))
    });
    assert(savedRecords.length === 3, 'Records count is exactly 3 (no duplicates created on upsert)');
    const s2Updated = savedRecords.find(x => x.studentId.toString() === '65dd00000000000000000002');
    assert(s2Updated && s2Updated.status === 'PRESENT', 'SE002 status was updated to PRESENT');

    // Clean up test records
    await Attendance.deleteMany({
        classId: '65bb00000000000000000001',
        date: new Date(Date.UTC(2026, 2, 17))
    });

    console.log(`\n========================================`);
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log(`========================================\n`);

    server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});

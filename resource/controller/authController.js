const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Student = require('../models/students');
require('dotenv').config();

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(401).json({ message: 'Email and password are required' });
        }

        // Find student by email
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT with studentId in payload, expires in 1 hour
        const token = jwt.sign(
            { studentId: student._id, email: student.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { login };

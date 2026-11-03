const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Check if Authorization header exists
    if (!authHeader) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Token must follow format: Bearer <token>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ message: 'Invalid token format. Use: Bearer <token>' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // store decoded payload (contains studentId, email)
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = verifyToken;

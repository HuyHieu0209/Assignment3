const express = require('express');
const router = express.Router();
const { login } = require('../controller/authController');

// POST /api/auth/login
router.post('/login', login);

module.exports = router;

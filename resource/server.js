const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config();

const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();

connectDB();

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Practical Exam!' });
});

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

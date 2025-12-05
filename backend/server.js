require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;
const helmet = require('helmet');
app.use(helmet());

// DB connect
connectDB(process.env.MONGO_URI);

// middlewares
app.use(cors());
app.use(express.json());

// health routes
app.get('/', (req, res) => res.send('Poultry backend running'));
app.get('/api/health', (req, res) => res.json({ ok: true }));
const authMiddleware = require('./middleware/auth');

// example protected route
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// your routes ---------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/flocks', authMiddleware, require('./routes/flocks'));
app.use('/api/feed', authMiddleware, require('./routes/feed'));
app.use('/api/medicine', authMiddleware, require('./routes/medicine'));
app.use('/api/daily', authMiddleware, require('./routes/dailyMonitoring'));
app.use('/api/sale', authMiddleware, require('./routes/sale'));
app.use('/api/current-report', authMiddleware, require('./routes/currentReport'));
app.use('/api/closing-report', authMiddleware, require('./routes/closingReport'));

// ----------------------------------------

// start server
app.listen(PORT, () => console.log(`Server started on ${PORT}`));

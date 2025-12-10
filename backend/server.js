require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_MONGO_URI = 'mongodb+srv://rkpoultry:mukesh@946@poultry.rhjgjoy.mongodb.net/?appName=Poultry';
const helmet = require('helmet');

// DB connect
connectDB(process.env.MONGO_URI || DEFAULT_MONGO_URI);

// middlewares
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://poultry-farm-6pyr.vercel.app',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser tools
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(helmet());
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
app.use('/api/admin', authMiddleware, require('./routes/adminOverview'));

// ----------------------------------------

// start server
app.listen(PORT, () => console.log(`Server started on ${PORT}`));

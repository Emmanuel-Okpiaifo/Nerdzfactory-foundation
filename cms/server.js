require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./db');

const authRoutes = require('./routes/auth');
const opportunityRoutes = require('./routes/opportunities');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set. Using insecure default for development only.');
  process.env.JWT_SECRET = 'dev-secret-change-in-production';
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));

const distAdmin = path.join(__dirname, '..', 'dist-admin');
const adminDir = fs.existsSync(path.join(distAdmin, 'index.html'))
  ? distAdmin
  : path.join(__dirname, 'public', 'admin');

const imgDir = fs.existsSync(path.join(distAdmin, 'img'))
  ? path.join(distAdmin, 'img')
  : path.join(__dirname, 'public', 'img');

app.use('/img', express.static(imgDir));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/admin', express.static(adminDir, { index: 'index.html' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nerdzfactory-opportunities-cms' });
});

app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/opportunities', opportunityRoutes);

app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Opportunities CMS running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin (${adminDir === distAdmin ? 'dist-admin' : 'dev source'})`);
  console.log(`API: http://localhost:${PORT}/api/opportunities`);
});

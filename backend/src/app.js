const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { authLimiter, globalLimiter } = require('./middlewares/rateLimiter');
const { error } = require('./utils/response');

const authRoutes          = require('./routes/auth.routes');
const profileRoutes       = require('./routes/profile.routes');
const skillsRoutes        = require('./routes/skills.routes');
const availabilitiesRoutes = require('./routes/availabilities.routes');
const searchRoutes        = require('./routes/search.routes');

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(globalLimiter);

// Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/v1/auth',           authLimiter, authRoutes);
app.use('/api/v1/profile',        profileRoutes);
app.use('/api/v1/skills',         skillsRoutes);
app.use('/api/v1/availabilities', availabilitiesRoutes);
app.use('/api/v1/search',         searchRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ data: { status: 'ok' }, meta: { timestamp: new Date().toISOString() } }));

// 404
app.use((_req, res) => error(res, 404, 'NOT_FOUND', 'Route not found.'));

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  error(res, status, 'INTERNAL_ERROR', err.message || 'Internal server error.');
});

module.exports = app;

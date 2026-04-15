'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const corsConfig   = require('./config/cors');
const requestId    = require('./middlewares/requestId');
const httpLogger   = require('./middlewares/httpLogger');
const errorHandler = require('./middlewares/errorHandler');
const { authLimiter, globalLimiter } = require('./middlewares/rateLimiter');
const { error }    = require('./utils/response');

const authRoutes           = require('./routes/auth.routes');
const profileRoutes        = require('./routes/profile.routes');
const skillsRoutes         = require('./routes/skills.routes');
const availabilitiesRoutes = require('./routes/availabilities.routes');
const searchRoutes         = require('./routes/search.routes');
const exchangesRoutes      = require('./routes/exchanges.routes');
const reviewsRoutes        = require('./routes/reviews.routes');
const healthRoutes         = require('./routes/health.routes');
const notificationsRoutes  = require('./routes/notifications.routes');
const adminRoutes          = require('./routes/admin.routes');
const reportsRoutes        = require('./routes/reports.routes');
const badgesRoutes         = require('./routes/badges.routes');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:     true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy:   true,
  crossOriginResourcePolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(cors(corsConfig));

// ─── Observability ──────────────────────────────────────────────────────────────
app.use(requestId);
app.use(httpLogger);

// ─── Rate limiting ───────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Body parsers ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static files ────────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────────
app.use('/health',                     healthRoutes);
app.use('/api/v1/auth',                authLimiter, authRoutes);
app.use('/api/v1/profile',             profileRoutes);
app.use('/api/v1/skills',              skillsRoutes);
app.use('/api/v1/availabilities',      availabilitiesRoutes);
app.use('/api/v1/search',              searchRoutes);
app.use('/api/v1/exchanges',           exchangesRoutes);
app.use('/api/v1/users',               reviewsRoutes);
app.use('/api/v1/notifications',       notificationsRoutes);
app.use('/api/v1/reports',             reportsRoutes);
app.use('/api/v1/admin',               adminRoutes);
app.use('/api/v1/badges',              badgesRoutes);

// ─── Fallthrough & error handlers ──────────────────────────────────────────────────────
app.use((_req, res) => error(res, 404, 'NOT_FOUND', 'Route not found.'));
app.use(errorHandler);

module.exports = app;

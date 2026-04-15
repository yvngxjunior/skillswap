'use strict';

const rateLimit = require('express-rate-limit');

// Strict limiter for auth endpoints (20 req / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Global limiter for all routes (120 req / min)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Report limiter — max 5 reports per user per day
// Key by user ID extracted from the JWT (set by authenticate middleware).
// Falls back to IP if req.user is not yet populated (should not happen on
// the reports route which sits behind authenticate).
const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have reached the daily report limit (5 per day).' },
});

module.exports = { authLimiter, globalLimiter, reportLimiter };

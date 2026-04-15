'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin }  = require('../middlewares/requireAdmin');
const {
  overview,
  exchangeVolume,
  popularSkills,
  userRetention,
} = require('../controllers/analytics.controller');

const router = Router();

// All admin routes require a valid JWT AND admin role
router.use(authenticate, requireAdmin);

// ── Analytics ─────────────────────────────────────────────────────────
// Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD on all 4 endpoints

router.get('/analytics/overview',        overview);
router.get('/analytics/exchange-volume', exchangeVolume);
router.get('/analytics/popular-skills',  popularSkills);
router.get('/analytics/user-retention',  userRetention);

module.exports = router;

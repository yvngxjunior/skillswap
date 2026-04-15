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
const {
  listReports,
  updateReport,
  softDeleteUser,
  softDeleteExchange,
} = require('../controllers/moderation.controller');

const router = Router();

// All admin routes require a valid JWT AND admin role
router.use(authenticate, requireAdmin);

// ── Analytics ──────────────────────────────────────────────────────────────────
router.get('/analytics/overview',        overview);
router.get('/analytics/exchange-volume', exchangeVolume);
router.get('/analytics/popular-skills',  popularSkills);
router.get('/analytics/user-retention',  userRetention);

// ── Moderation ─────────────────────────────────────────────────────────────────
router.get('/reports',             listReports);
router.patch('/reports/:id',       updateReport);
router.delete('/users/:id',        softDeleteUser);
router.delete('/exchanges/:id',    softDeleteExchange);

module.exports = router;

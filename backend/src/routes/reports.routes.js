'use strict';

const { Router } = require('express');
const { authenticate }  = require('../middlewares/auth.middleware');
const { reportLimiter } = require('../middlewares/rateLimiter');
const { createReport }  = require('../controllers/reports.controller');

const router = Router();

// Skip rate limiter in test environment (all requests share the same IP)
const limiterMiddleware = process.env.NODE_ENV === 'test'
  ? (_req, _res, next) => next()
  : reportLimiter;

router.post('/', authenticate, limiterMiddleware, createReport);

module.exports = router;

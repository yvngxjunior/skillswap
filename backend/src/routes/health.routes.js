const { Router } = require('express');
const { pool } = require('../database/pool');
const router = Router();

/**
 * GET /health
 * Basic liveness probe — always returns 200 if the process is alive.
 */
router.get('/', (_req, res) => {
  res.json({
    data: { status: 'ok' },
    meta: { timestamp: new Date().toISOString() },
  });
});

/**
 * GET /health/ready
 * Readiness probe — checks DB connectivity.
 */
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      data: { status: 'ready', db: 'connected' },
      meta: { requestId: req.id, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'Database not reachable' },
      meta: { requestId: req.id, timestamp: new Date().toISOString() },
    });
  }
});

module.exports = router;

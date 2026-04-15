'use strict';

const { Router } = require('express');
const pool = require('../database/db');
const router = Router();

/**
 * GET /health
 * Liveness probe — always 200 if the process is alive.
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

/**
 * GET /health/metrics
 * Process metrics — exposes uptime, memory usage, and runtime info.
 * Should be protected behind internal network / admin auth in production.
 */
router.get('/metrics', (req, res) => {
  const mem = process.memoryUsage();
  const toMb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

  res.json({
    data: {
      uptime_seconds: Math.floor(process.uptime()),
      memory: {
        rss_mb:        toMb(mem.rss),
        heap_used_mb:  toMb(mem.heapUsed),
        heap_total_mb: toMb(mem.heapTotal),
        external_mb:   toMb(mem.external),
      },
      node_version: process.version,
      env:          process.env.NODE_ENV || 'development',
    },
    meta: { requestId: req.id, timestamp: new Date().toISOString() },
  });
});

module.exports = router;

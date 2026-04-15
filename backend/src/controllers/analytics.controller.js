'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build an optional SQL date-range filter fragment and push params.
 * Returns an empty string if neither `from` nor `to` is provided.
 *
 * @param {string|undefined} from   - ISO date string (inclusive lower bound)
 * @param {string|undefined} to     - ISO date string (inclusive upper bound)
 * @param {Array}            params - Mutable params array (will be pushed into)
 * @param {string}           col    - Column name to filter on
 * @returns {string} SQL fragment starting with 'AND …' or ''
 */
function _dateFilter(from, to, params, col = 'created_at') {
  const parts = [];
  if (from) { params.push(from); parts.push(`${col} >= $${params.length}`); }
  if (to)   { params.push(to);   parts.push(`${col} <= $${params.length}`); }
  return parts.length ? 'AND ' + parts.join(' AND ') : '';
}

// ── Controllers ───────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/analytics/overview
 * High-level platform statistics: total users, exchanges by status,
 * total reviews, average rating, and 7-day active users.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function overview(req, res) {
  try {
    const [users, exchanges, reviews, activeUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT status, COUNT(*) FROM exchanges GROUP BY status'),
      pool.query('SELECT COUNT(*), ROUND(AVG(overall), 2) AS avg_rating FROM reviews'),
      pool.query(`
        SELECT COUNT(DISTINCT sender_id) AS active_users_7d
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
    ]);

    return success(res, {
      totalUsers: parseInt(users.rows[0].count, 10),
      exchangesByStatus: exchanges.rows.reduce(
        (acc, r) => ({ ...acc, [r.status]: parseInt(r.count, 10) }),
        {}
      ),
      totalReviews:   parseInt(reviews.rows[0].count, 10),
      averageRating:  reviews.rows[0].avg_rating ? parseFloat(reviews.rows[0].avg_rating) : null,
      activeUsers7d:  parseInt(activeUsers.rows[0].active_users_7d, 10),
    });
  } catch (err) {
    logger.error('analytics.overview error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * GET /api/v1/admin/analytics/exchange-volume
 * Daily exchange counts grouped by status.
 * Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD query params.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function exchangeVolume(req, res) {
  const { from, to } = req.query;
  const params = [];
  const dateFilter = _dateFilter(from, to, params);

  try {
    const result = await pool.query(
      `SELECT
         DATE_TRUNC('day', created_at) AS day,
         status,
         COUNT(*)                      AS count
       FROM exchanges
       WHERE 1=1 ${dateFilter}
       GROUP BY 1, 2
       ORDER BY 1 DESC, 2`,
      params
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('analytics.exchangeVolume error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * GET /api/v1/admin/analytics/popular-skills
 * Top 20 most-requested skills by exchange count.
 * Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD query params.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function popularSkills(req, res) {
  const { from, to } = req.query;
  const params = [];
  const dateFilter = _dateFilter(from, to, params, 'e.created_at');

  try {
    const result = await pool.query(
      `SELECT
         s.id,
         s.name,
         s.category,
         COUNT(e.id) AS request_count
       FROM exchanges e
       JOIN skills s ON s.id = e.skill_id
       WHERE 1=1 ${dateFilter}
       GROUP BY s.id, s.name, s.category
       ORDER BY request_count DESC
       LIMIT 20`,
      params
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('analytics.popularSkills error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * GET /api/v1/admin/analytics/user-retention
 * Weekly new-user signup counts.
 * Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD query params.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function userRetention(req, res) {
  const { from, to } = req.query;
  const params = [];
  const dateFilter = _dateFilter(from, to, params);

  try {
    const result = await pool.query(
      `SELECT
         DATE_TRUNC('week', created_at) AS week,
         COUNT(*)                       AS new_users
       FROM users
       WHERE 1=1 ${dateFilter}
       GROUP BY 1
       ORDER BY 1 DESC`,
      params
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('analytics.userRetention error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { overview, exchangeVolume, popularSkills, userRetention };

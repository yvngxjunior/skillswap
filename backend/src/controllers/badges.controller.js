'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * GET /api/v1/badges
 * Public endpoint — returns the full list of available badges.
 */
async function listBadges(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, slug, label, description, icon, threshold FROM badges ORDER BY threshold ASC'
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('listBadges error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listBadges };

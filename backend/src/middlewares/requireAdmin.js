'use strict';

const pool = require('../database/db');
const { error } = require('../utils/response');

/**
 * Express middleware that restricts access to users whose `role` is 'admin'.
 * Must be placed AFTER the `authenticate` middleware so `req.user.id` is available.
 *
 * Performs a DB look-up on every request (not just JWT claim) so that a
 * role downgrade takes effect immediately without requiring a token refresh.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0 || rows[0].role !== 'admin') {
      return error(res, 403, 'FORBIDDEN', 'Admin access required.');
    }
    next();
  } catch (err) {
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { requireAdmin };

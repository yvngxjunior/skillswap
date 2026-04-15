'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { z }  = require('zod');

// ── Zod schemas ────────────────────────────────────────────────────────

const registerTokenSchema = z.object({
  expo_push_token: z.string().min(1).max(200),
});

// ── Controllers ────────────────────────────────────────────────────────

/**
 * GET /api/v1/notifications
 * Returns paginated notifications for the authenticated user,
 * ordered newest-first, with unread count in meta.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function listNotifications(req, res) {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit,  10) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

  try {
    const [rows, total, unread] = await Promise.all([
      pool.query(
        `SELECT * FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]),
      pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      ),
    ]);

    return success(res, rows.rows, 200, {
      total:  parseInt(total.rows[0].count,  10),
      unread: parseInt(unread.rows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    logger.error('listNotifications error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/notifications/:notificationId/read
 * Marks a single notification as read (idempotent if already read → 404).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function markRead(req, res) {
  const userId             = req.user.id;
  const { notificationId } = req.params;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [notificationId, userId]
    );
    if (result.rowCount === 0) {
      return error(res, 404, 'NOT_FOUND', 'Notification not found or already read.');
    }
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('markRead error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Marks every unread notification for the current user as read.
 * Returns { updated: <count> }.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function markAllRead(req, res) {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return success(res, { updated: result.rowCount });
  } catch (err) {
    logger.error('markAllRead error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * POST /api/v1/notifications/push-token
 * Register or update an Expo push token for the authenticated user.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function registerPushToken(req, res) {
  const userId = req.user.id;
  const parsed = registerTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'VALIDATION_ERROR', 'Invalid input.', parsed.error.errors);
  }
  const { expo_push_token } = parsed.data;

  try {
    await pool.query(
      'UPDATE users SET expo_push_token = $1 WHERE id = $2',
      [expo_push_token, userId]
    );
    return success(res, { registered: true });
  } catch (err) {
    logger.error('registerPushToken error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listNotifications, markRead, markAllRead, registerPushToken };

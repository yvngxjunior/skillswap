'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { z }  = require('zod');

// ── Zod schemas ────────────────────────────────────────────────────────

// Accept both 'token' (test / mobile client) and 'expo_push_token' (legacy)
const registerTokenSchema = z.object({
  token:           z.string().min(1).max(200).optional(),
  expo_push_token: z.string().min(1).max(200).optional(),
}).refine(d => d.token || d.expo_push_token, {
  message: 'token is required',
});

// ── Controllers ────────────────────────────────────────────────────────

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

async function markRead(req, res) {
  const userId             = req.user.id;
  const { notificationId } = req.params;

  try {
    // Fetch first so we can distinguish 404 (doesn't exist) from 403 (wrong owner)
    const { rows } = await pool.query(
      'SELECT id, user_id, read_at FROM notifications WHERE id = $1',
      [notificationId]
    );

    if (rows.length === 0) {
      return error(res, 404, 'NOT_FOUND', 'Notification not found.');
    }

    if (rows[0].user_id !== userId) {
      return error(res, 403, 'FORBIDDEN', 'You do not have access to this notification.');
    }

    if (rows[0].read_at !== null) {
      return error(res, 404, 'NOT_FOUND', 'Notification already read.');
    }

    const result = await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 RETURNING *`,
      [notificationId]
    );
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('markRead error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

async function markAllRead(req, res) {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return success(res, { updated: result.rowCount });
  } catch (err) {
    logger.error('markAllRead error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

async function registerPushToken(req, res) {
  const userId = req.user.id;
  const parsed = registerTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message);
  }

  // Prefer 'token' (current client field), fall back to legacy 'expo_push_token'
  const pushToken = parsed.data.token || parsed.data.expo_push_token;

  try {
    await pool.query(
      'UPDATE users SET push_token = $1 WHERE id = $2',
      [pushToken, userId]
    );
    return success(res, { registered: true });
  } catch (err) {
    logger.error('registerPushToken error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listNotifications, markRead, markAllRead, registerPushToken };

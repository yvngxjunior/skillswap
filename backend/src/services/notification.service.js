'use strict';

const pool   = require('../database/db');
const logger = require('../utils/logger');

/** @type {import('socket.io').Server|null} */
let _io = null;

/**
 * Attach the Socket.io server instance so notifications can be
 * delivered in real-time to the recipient's personal room.
 * Called once from socket/index.js after the io server is created.
 * @param {import('socket.io').Server} io
 */
function setIo(io) {
  _io = io;
}

/**
 * Persist a notification row to the DB and emit it via Socket.io
 * to the recipient's personal room (`user:<userId>`).
 * Also attempts an Expo push notification if the user has a token.
 *
 * @param {object} opts
 * @param {string} opts.userId         - Recipient user UUID
 * @param {string} opts.type           - notification_type enum value
 * @param {object} [opts.payload={}]   - Arbitrary JSON metadata
 * @returns {Promise<object>}          The created notification row
 */
async function createNotification({ userId, type, payload = {} }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, type, JSON.stringify(payload)]
    );
    const notification = result.rows[0];

    // Real-time delivery via Socket.io personal room
    if (_io) {
      _io.to(`user:${userId}`).emit('notification', notification);
    }

    // Fire-and-forget Expo push (never throws to caller)
    _sendExpoPush(userId, type, payload).catch(() => {});

    return notification;
  } catch (err) {
    logger.error('createNotification error', { error: err.message, userId, type });
    throw err;
  }
}

/**
 * Send an Expo push notification if the user has a registered push token
 * and the EXPO_ACCESS_TOKEN env var is set.
 * Errors are swallowed — push failures must never crash the main flow.
 *
 * @param {string} userId
 * @param {string} type
 * @param {object} payload
 * @returns {Promise<void>}
 */
async function _sendExpoPush(userId, type, payload) {
  if (!process.env.EXPO_ACCESS_TOKEN) return;
  try {
    const { rows } = await pool.query(
      'SELECT expo_push_token FROM users WHERE id = $1 AND expo_push_token IS NOT NULL',
      [userId]
    );
    if (rows.length === 0) return;

    const body = _buildPushBody(type, payload);
    // Use built-in fetch (Node 18+) or fall back to node-fetch
    const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    await fetchFn('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to:    rows[0].expo_push_token,
        title: 'SkillSwap',
        body,
      }),
    });
  } catch (err) {
    logger.warn('Expo push failed (non-fatal)', { error: err.message, userId });
  }
}

/**
 * Map a notification type to a human-readable push body string.
 * @param {string} type
 * @param {object} payload
 * @returns {string}
 */
function _buildPushBody(type, payload) {
  const map = {
    exchange_request:   `${payload.requesterPseudo ?? 'Someone'} sent you an exchange request.`,
    exchange_accepted:  'Your exchange request was accepted!',
    exchange_cancelled: 'An exchange was cancelled.',
    exchange_completed: 'An exchange has been completed. Leave a review!',
    new_message:        `New message from ${payload.senderPseudo ?? 'someone'}.`,
    new_review:         'You received a new review!',
  };
  return map[type] ?? 'You have a new notification.';
}

module.exports = { setIo, createNotification };

'use strict';

/**
 * Notification service.
 *
 * Provides a single entry point — `notify()` — used by every controller
 * that triggers a notification-worthy event.  The function:
 *
 *   1. Persists a row in the `notifications` table.
 *   2. Emits a Socket.io `notification` event to the user’s personal
 *      room (`user:<userId>`) so connected clients update instantly.
 *
 * The Socket.io `io` instance is injected once at server start via
 * `setIo()`.  Controllers that run before the socket server is ready
 * (unlikely, but safe) will still persist to DB without crashing.
 */

const pool   = require('../database/db');
const logger = require('../utils/logger');

/** @type {import('socket.io').Server|null} */
let _io = null;

/**
 * Inject the Socket.io server instance (called from server.js).
 * @param {import('socket.io').Server} io
 */
function setIo(io) {
  _io = io;
}

/**
 * Create and deliver a notification.
 *
 * @param {object} opts
 * @param {string} opts.userId   - UUID of the recipient
 * @param {string} opts.type     - notification_type enum value
 * @param {object} opts.payload  - JSONB payload (event-specific context)
 * @param {import('pg').PoolClient} [opts.client] - optional PG client for transactional inserts
 * @returns {Promise<object>}    The persisted notification row
 */
async function notify({ userId, type, payload = {}, client }) {
  const db = client || pool;

  const result = await db.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, type, payload, read_at, created_at`,
    [userId, type, JSON.stringify(payload)]
  );

  const notification = result.rows[0];

  // Real-time delivery: fire-and-forget; never let socket errors
  // bubble up to the caller or break an in-flight DB transaction.
  try {
    if (_io) {
      _io.to(`user:${userId}`).emit('notification', notification);
    }
  } catch (err) {
    logger.warn('Socket notification emit failed', { userId, type, error: err.message });
  }

  logger.debug('Notification created', { userId, type, id: notification.id });
  return notification;
}

module.exports = { setIo, notify };

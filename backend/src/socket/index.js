'use strict';

const { Server } = require('socket.io');
const jwt  = require('jsonwebtoken');
const pool = require('../database/db');
const logger = require('../utils/logger');
const { setIo, createNotification } = require('../services/notification.service');

/**
 * Initialise the Socket.io server and attach event handlers.
 * Also registers the io instance with the notification service so
 * real-time notifications can be emitted from any controller.
 *
 * @param {import('http').Server} server - The Node.js HTTP server
 * @returns {import('socket.io').Server}
 */
function initSocket(server) {
  const io = new Server(server, {
    cors:        { origin: '*' },
    pingTimeout: 60000,
  });

  // Share the io instance with the notification service
  setIo(io);

  // ── JWT Auth middleware ─────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      socket.pseudo = payload.pseudo;
      next();
    } catch {
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug('Socket connected', { userId: socket.userId });

    // Every authenticated user auto-joins their personal notification room
    socket.join(`user:${socket.userId}`);

    // ── Join a conversation room ────────────────────────────────────
    socket.on('join_exchange', async ({ exchangeId }) => {
      try {
        const result = await pool.query(
          'SELECT id FROM exchanges WHERE id = $1 AND (requester_id = $2 OR partner_id = $2)',
          [exchangeId, socket.userId]
        );
        if (result.rowCount === 0) {
          socket.emit('error', { message: 'Not your exchange.' });
          return;
        }
        socket.join(`exchange:${exchangeId}`);
        socket.emit('joined_exchange', { exchangeId });
        logger.debug('Socket joined exchange', { userId: socket.userId, exchangeId });
      } catch (err) {
        logger.error('join_exchange error', { error: err.message });
      }
    });

    // ── Send a message ──────────────────────────────────────────────
    socket.on('send_message', async ({ exchangeId, content }) => {
      if (!exchangeId || !content?.trim()) return;
      if (content.length > 2000) {
        socket.emit('error', { message: 'Message too long (max 2000 chars).' });
        return;
      }

      try {
        const exchResult = await pool.query(
          `SELECT id, status, requester_id, partner_id FROM exchanges
           WHERE id = $1 AND (requester_id = $2 OR partner_id = $2)`,
          [exchangeId, socket.userId]
        );
        if (exchResult.rowCount === 0 || !['accepted', 'completed'].includes(exchResult.rows[0].status)) {
          socket.emit('error', { message: 'Cannot send messages in this exchange.' });
          return;
        }

        const msgResult = await pool.query(
          `INSERT INTO messages (exchange_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, content, created_at`,
          [exchangeId, socket.userId, content.trim()]
        );
        const msg = msgResult.rows[0];
        const payload = { ...msg, sender: { id: socket.userId, pseudo: socket.pseudo } };

        // Broadcast to everyone in the exchange room
        io.to(`exchange:${exchangeId}`).emit('new_message', payload);

        // Notify the OTHER participant via their personal room
        const ex          = exchResult.rows[0];
        const recipientId = ex.requester_id === socket.userId ? ex.partner_id : ex.requester_id;
        createNotification({
          userId:  recipientId,
          type:    'new_message',
          payload: {
            exchangeId,
            messageId:   msg.id,
            senderPseudo: socket.pseudo,
          },
        }).catch(err => logger.warn('notification failed', { error: err.message }));

      } catch (err) {
        logger.error('send_message error', { error: err.message });
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // ── Typing indicator ────────────────────────────────────────────
    socket.on('typing', ({ exchangeId }) => {
      socket.to(`exchange:${exchangeId}`).emit('partner_typing', {
        userId: socket.userId,
        pseudo: socket.pseudo,
      });
    });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { userId: socket.userId });
    });
  });

  return io;
}

module.exports = { initSocket };

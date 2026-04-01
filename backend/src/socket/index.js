const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const logger = require('../utils/logger');

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 60000,
  });

  // ── JWT Auth middleware for Socket.io ───────────────────────────────
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

    // Join personal notification room
    socket.join(`user:${socket.userId}`);

    // ── Join a conversation room ─────────────────────────────────
    // Client emits: { exchangeId }
    socket.on('join_exchange', async ({ exchangeId }) => {
      try {
        // Verify user is a participant
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

    // ── Send a message ───────────────────────────────────────
    // Client emits: { exchangeId, content }
    socket.on('send_message', async ({ exchangeId, content }) => {
      if (!exchangeId || !content?.trim()) return;
      if (content.length > 2000) {
        socket.emit('error', { message: 'Message too long (max 2000 chars).' });
        return;
      }

      try {
        // Verify participant and exchange is active
        const exchResult = await pool.query(
          `SELECT id, status FROM exchanges
           WHERE id = $1 AND (requester_id = $2 OR partner_id = $2)`,
          [exchangeId, socket.userId]
        );
        if (exchResult.rowCount === 0 || !['accepted', 'completed'].includes(exchResult.rows[0].status)) {
          socket.emit('error', { message: 'Cannot send messages in this exchange.' });
          return;
        }

        // Persist to DB
        const msgResult = await pool.query(
          `INSERT INTO messages (exchange_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, content, created_at`,
          [exchangeId, socket.userId, content.trim()]
        );
        const msg = msgResult.rows[0];

        const payload = {
          ...msg,
          sender: { id: socket.userId, pseudo: socket.pseudo },
        };

        // Broadcast to all room members (including sender for confirmation)
        io.to(`exchange:${exchangeId}`).emit('new_message', payload);
      } catch (err) {
        logger.error('send_message error', { error: err.message });
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // ── Typing indicator ──────────────────────────────────────
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

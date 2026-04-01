const pool = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get message history for an exchange.
 * Both participants can read.
 */
async function getMessages(req, res) {
  const userId = req.user.id;
  const { exchangeId } = req.params;
  const { limit = 50, before } = req.query; // cursor-based: before = message id

  try {
    // Verify participant
    const exch = await pool.query(
      'SELECT id FROM exchanges WHERE id = $1 AND (requester_id = $2 OR partner_id = $2)',
      [exchangeId, userId]
    );
    if (exch.rowCount === 0) return error(res, 403, 'FORBIDDEN', 'Not your exchange.');

    const safeLimit = Math.min(parseInt(limit) || 50, 100);
    const params = [exchangeId];
    let cursorClause = '';
    if (before) {
      params.push(before);
      cursorClause = `AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
    }

    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.read_at,
              json_build_object('id', u.id, 'pseudo', u.pseudo, 'photo_url', u.photo_url) AS sender
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.exchange_id = $1 ${cursorClause}
       ORDER BY m.created_at DESC
       LIMIT ${safeLimit}`,
      params
    );

    // Mark messages as read (not sent by me, not yet read)
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE exchange_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [exchangeId, userId]
    );

    return success(res, result.rows.reverse());
  } catch (err) {
    logger.error('getMessages error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * REST fallback to send a message (Socket.io is the primary path).
 */
async function sendMessage(req, res) {
  const userId = req.user.id;
  const { exchangeId } = req.params;
  const { content } = req.body;

  try {
    const exch = await pool.query(
      `SELECT id, status FROM exchanges
       WHERE id = $1 AND (requester_id = $2 OR partner_id = $2)`,
      [exchangeId, userId]
    );
    if (exch.rowCount === 0) return error(res, 403, 'FORBIDDEN', 'Not your exchange.');
    if (!['accepted', 'completed'].includes(exch.rows[0].status)) {
      return error(res, 400, 'INVALID_STATE', 'Messaging is only available on accepted exchanges.');
    }

    const result = await pool.query(
      'INSERT INTO messages (exchange_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [exchangeId, userId, content]
    );
    return success(res, result.rows[0], 201);
  } catch (err) {
    logger.error('sendMessage error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { getMessages, sendMessage };

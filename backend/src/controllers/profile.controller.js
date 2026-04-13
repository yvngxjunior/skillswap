const pool = require('../database/db');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

const PUBLIC_FIELDS = 'id, email, pseudo, bio, photo_url, credit_balance, exchange_count, average_rating, created_at';

async function getProfile(req, res) {
  const userId = req.params.userId || req.user.id;

  try {
    const result = await pool.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('Get profile error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateProfile(req, res) {
  const userId = req.user.id;
  const { pseudo, bio } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    // Check pseudo uniqueness if changing it
    if (pseudo) {
      const conflict = await pool.query(
        'SELECT id FROM users WHERE pseudo = $1 AND id != $2',
        [pseudo, userId]
      );
      if (conflict.rowCount > 0) {
        return res.status(409).json({ error: 'Pseudo already taken.' });
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (pseudo !== undefined) { fields.push(`pseudo = $${idx++}`); values.push(pseudo); }
    if (bio !== undefined)    { fields.push(`bio = $${idx++}`);    values.push(bio); }
    if (photo_url !== undefined) { fields.push(`photo_url = $${idx++}`); values.push(photo_url); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${PUBLIC_FIELDS}`,
      values
    );

    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getProfile, updateProfile };

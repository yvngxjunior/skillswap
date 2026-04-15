'use strict';

const pool   = require('../database/db');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

const PUBLIC_FIELDS = 'id, email, pseudo, bio, photo_url, credit_balance, exchange_count, average_rating, created_at';

/**
 * Helper: fetch badges earned by a user.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function _fetchBadges(userId) {
  try {
    const result = await pool.query(
      `SELECT b.slug, b.label, b.description, b.icon, b.threshold, ub.awarded_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY b.threshold ASC`,
      [userId]
    );
    return result.rows;
  } catch (_err) {
    // badges table may not exist in older test DBs — return empty gracefully
    return [];
  }
}

/**
 * GET /api/v1/profile/me  (or /:userId for public view)
 * Returns the public profile of a user, including earned badges.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function getProfile(req, res) {
  const userId = req.params.userId || req.user.id;

  try {
    const [userResult, badgesResult] = await Promise.all([
      pool.query(
        `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
        [userId]
      ),
      _fetchBadges(userId),
    ]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return success(res, { ...userResult.rows[0], badges: badgesResult });
  } catch (err) {
    logger.error('Get profile error', { error: err.message, userId });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * PUT /api/v1/profile/me
 * Updates the authenticated user's own profile (optional avatar upload).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function updateProfile(req, res) {
  const userId   = req.user.id;
  const { pseudo, bio } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
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

    if (pseudo    !== undefined) { fields.push(`pseudo    = $${idx++}`); values.push(pseudo);    }
    if (bio       !== undefined) { fields.push(`bio       = $${idx++}`); values.push(bio);       }
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
    logger.error('Update profile error', { error: err.message, userId });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/v1/profile/me/data
 * GDPR data portability — returns a full export of all personal data.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function exportMyData(req, res) {
  const userId = req.user.id;

  try {
    const [user, skills, exchanges, reviews, messages] = await Promise.all([
      pool.query(
        `SELECT id, email, pseudo, bio, photo_url, credit_balance,
                exchange_count, average_rating, created_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT us.id, us.type, us.level, us.created_at,
                s.name AS skill_name, s.category
         FROM user_skills us
         JOIN skills s ON s.id = us.skill_id
         WHERE us.user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, requester_id, partner_id, skill_id, duration_minutes,
                desired_date, status, message, created_at, updated_at
         FROM exchanges
         WHERE requester_id = $1 OR partner_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, exchange_id, reviewer_id, reviewee_id,
                punctuality, pedagogy, respect, overall, comment, created_at
         FROM reviews
         WHERE reviewer_id = $1 OR reviewee_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, exchange_id, content, created_at
         FROM messages
         WHERE sender_id = $1`,
        [userId]
      ),
    ]);

    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    logger.info('GDPR data export requested', { userId });

    return success(res, {
      profile:   user.rows[0],
      skills:    skills.rows,
      exchanges: exchanges.rows,
      reviews:   reviews.rows,
      messages:  messages.rows,
    });
  } catch (err) {
    logger.error('GDPR export error', { error: err.message, userId });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * DELETE /api/v1/profile/me
 * GDPR right to erasure — anonymises the account in a transaction.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function deleteMyAccount(req, res) {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );

    await client.query(
      `UPDATE users SET
         email         = 'deleted_' || id || '@deleted.invalid',
         pseudo        = 'deleted_' || left(id::text, 8),
         password_hash = '',
         bio           = '',
         photo_url     = NULL,
         birth_date    = '1970-01-01'
       WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');
    logger.info('GDPR account erasure completed', { userId });
    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('GDPR delete error', { error: err.message, userId });
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
}

module.exports = { getProfile, updateProfile, exportMyData, deleteMyAccount };

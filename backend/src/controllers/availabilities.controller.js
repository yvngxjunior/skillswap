const pool = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

async function getAvailabilities(req, res) {
  const userId = req.params.userId || req.user.id;
  try {
    const result = await pool.query(
      `SELECT id, day_of_week, start_time, end_time
       FROM availabilities
       WHERE user_id = $1
       ORDER BY day_of_week, start_time`,
      [userId]
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('getAvailabilities error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

async function setAvailabilities(req, res) {
  const userId = req.user.id;
  const { slots } = req.body; // Array of { day_of_week, start_time, end_time }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Full replace: delete all existing slots then insert new ones
    await client.query('DELETE FROM availabilities WHERE user_id = $1', [userId]);

    for (const slot of slots) {
      await client.query(
        `INSERT INTO availabilities (user_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [userId, slot.day_of_week, slot.start_time, slot.end_time]
      );
    }

    await client.query('COMMIT');

    const result = await client.query(
      'SELECT id, day_of_week, start_time, end_time FROM availabilities WHERE user_id = $1 ORDER BY day_of_week, start_time',
      [userId]
    );
    return success(res, result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('setAvailabilities error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  } finally {
    client.release();
  }
}

module.exports = { getAvailabilities, setAvailabilities };

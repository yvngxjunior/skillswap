/**
 * Reviews service — Sprint 4
 * Recalculates a user's average_rating after a new review is submitted.
 */

const pool = require('../database/db');
const logger = require('../utils/logger');

/**
 * Recalculate and persist the average rating for a user.
 * Uses overall score average across all reviews where user is reviewee.
 */
async function recalculateAverageRating(client, userId) {
  const result = await client.query(
    'SELECT AVG(overall)::NUMERIC(3,2) AS avg FROM reviews WHERE reviewee_id = $1',
    [userId]
  );
  const avg = result.rows[0]?.avg || null;
  await client.query('UPDATE users SET average_rating = $1 WHERE id = $2', [avg, userId]);
  logger.info('Average rating updated', { userId, avg });
  return avg;
}

module.exports = { recalculateAverageRating };

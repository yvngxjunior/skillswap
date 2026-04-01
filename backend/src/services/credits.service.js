/**
 * Credits service — Sprint 4
 *
 * Time-credit rules:
 *   - Each user starts with 2 credits.
 *   - When an exchange is completed:
 *       teacher (skill offerer)  receives +1 credit
 *       learner (skill requester) loses   -1 credit
 *   - Credit balance can never go below 0 (checked before accepting an exchange).
 */

const pool = require('../database/db');
const logger = require('../utils/logger');

/**
 * Apply credit transfer atomically after an exchange completes.
 * @param {object} client - pg client (within a transaction)
 * @param {string} teacherId  - user who taught (gets +1)
 * @param {string} learnerId  - user who learnt  (gets -1)
 */
async function applyExchangeCredits(client, teacherId, learnerId) {
  // Increment teacher
  await client.query(
    'UPDATE users SET credit_balance = credit_balance + 1, exchange_count = exchange_count + 1 WHERE id = $1',
    [teacherId]
  );
  // Decrement learner (floor at 0 for safety)
  await client.query(
    'UPDATE users SET credit_balance = GREATEST(credit_balance - 1, 0), exchange_count = exchange_count + 1 WHERE id = $1',
    [learnerId]
  );
  logger.info('Credits applied', { teacherId, learnerId });
}

/**
 * Check if a user has at least 1 credit (required to request an exchange).
 */
async function hasEnoughCredits(userId) {
  const result = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.credit_balance > 0;
}

module.exports = { applyExchangeCredits, hasEnoughCredits };

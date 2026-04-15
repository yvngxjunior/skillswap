'use strict';

const pool   = require('../database/db');
const { createNotification } = require('./notification.service');
const logger = require('../utils/logger');

/**
 * Check all badge thresholds for a user and award any newly earned badges.
 * Safe to call multiple times — uses INSERT … ON CONFLICT DO NOTHING.
 *
 * @param {string} userId - UUID of the user to check
 * @returns {Promise<object[]>} Array of newly awarded badge rows (may be empty)
 */
async function checkAndAwardBadges(userId) {
  try {
    // Count completed exchanges for this user (as either participant)
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM exchanges
       WHERE status = 'completed'
         AND (requester_id = $1 OR partner_id = $1)`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch all badges the user does NOT yet have but is eligible for
    const eligible = await pool.query(
      `SELECT b.id, b.slug, b.label, b.icon
       FROM badges b
       WHERE b.threshold <= $1
         AND NOT EXISTS (
           SELECT 1 FROM user_badges ub
           WHERE ub.user_id = $2 AND ub.badge_id = b.id
         )
       ORDER BY b.threshold ASC`,
      [total, userId]
    );

    if (eligible.rows.length === 0) return [];

    const awarded = [];
    for (const badge of eligible.rows) {
      // Idempotent insert — concurrent calls are safe
      const result = await pool.query(
        `INSERT INTO user_badges (user_id, badge_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, badge_id) DO NOTHING
         RETURNING *`,
        [userId, badge.id]
      );

      if (result.rowCount > 0) {
        awarded.push({ ...result.rows[0], badge });

        // Fire new_badge notification — non-blocking
        createNotification({
          userId,
          type:    'new_badge',
          payload: { badgeSlug: badge.slug, badgeLabel: badge.label, badgeIcon: badge.icon },
        }).catch(err => logger.warn('badge notification failed', { error: err.message }));
      }
    }

    if (awarded.length > 0) {
      logger.info('badges awarded', { userId, count: awarded.length, slugs: awarded.map(a => a.badge.slug) });
    }

    return awarded;
  } catch (err) {
    // Badge errors must never crash the exchange completion flow
    logger.error('checkAndAwardBadges error', { error: err.message, userId });
    return [];
  }
}

module.exports = { checkAndAwardBadges };

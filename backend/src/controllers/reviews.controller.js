const pool = require('../database/db');
const { success, error } = require('../utils/response');
const { recalculateAverageRating } = require('../services/reviews.service');
const logger = require('../utils/logger');

/**
 * POST /api/v1/exchanges/:exchangeId/reviews
 * Submit a review after a completed exchange.
 */
async function createReview(req, res) {
  const reviewerId = req.user.id;
  const { exchangeId } = req.params;
  const { punctuality, pedagogy, respect, overall, comment } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify exchange is completed and requester is a participant
    const exch = await client.query(
      `SELECT requester_id, partner_id, status FROM exchanges WHERE id = $1`,
      [exchangeId]
    );
    if (exch.rowCount === 0) {
      await client.query('ROLLBACK');
      return error(res, 404, 'NOT_FOUND', 'Exchange not found.');
    }
    const ex = exch.rows[0];
    const isParticipant = ex.requester_id === reviewerId || ex.partner_id === reviewerId;
    if (!isParticipant) {
      await client.query('ROLLBACK');
      return error(res, 403, 'FORBIDDEN', 'Not your exchange.');
    }
    if (ex.status !== 'completed') {
      await client.query('ROLLBACK');
      return error(res, 400, 'INVALID_STATE', 'Can only review completed exchanges.');
    }

    // Reviewee is the other participant
    const revieweeId = ex.requester_id === reviewerId ? ex.partner_id : ex.requester_id;

    const result = await client.query(
      `INSERT INTO reviews (exchange_id, reviewer_id, reviewee_id, punctuality, pedagogy, respect, overall, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [exchangeId, reviewerId, revieweeId, punctuality, pedagogy, respect, overall, comment || '']
    );

    // Recalculate reviewee's average rating
    const newAvg = await recalculateAverageRating(client, revieweeId);

    await client.query('COMMIT');
    return success(res, { review: result.rows[0], reviewee_new_average: newAvg }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // unique violation
      return error(res, 409, 'DUPLICATE', 'You already reviewed this exchange.');
    }
    logger.error('createReview error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/users/:userId/reviews
 * Get all reviews left for a user.
 */
async function getUserReviews(req, res) {
  const { userId } = req.params;
  const { limit = 20, offset = 0 } = req.query;
  try {
    const result = await pool.query(
      `SELECT r.id, r.punctuality, r.pedagogy, r.respect, r.overall, r.comment, r.created_at,
              json_build_object('id', u.id, 'pseudo', u.pseudo, 'photo_url', u.photo_url) AS reviewer
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Math.min(parseInt(limit) || 20, 50), Math.max(parseInt(offset) || 0, 0)]
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('getUserReviews error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { createReview, getUserReviews };

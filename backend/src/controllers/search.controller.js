const pool = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * GET /api/v1/search/users
 * Query params:
 *   skill        - skill name (required)
 *   min_rating   - minimum average_rating filter (optional)
 *   limit        - page size (default 20, max 50)
 *   offset       - pagination offset (default 0)
 *
 * Returns users who OFFER the searched skill, excluding the requester.
 * Each result includes the user's offered + wanted skills and availability count.
 */
async function searchUsers(req, res) {
  const requesterId = req.user.id;
  const { skill, min_rating, limit = 20, offset = 0 } = req.query;

  if (!skill) {
    return error(res, 400, 'VALIDATION_ERROR', 'Query param `skill` is required.');
  }

  const safeLimit  = Math.min(parseInt(limit)  || 20, 50);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  try {
    const params = [`%${skill}%`, requesterId];
    let ratingClause = '';
    if (min_rating) {
      params.push(parseFloat(min_rating));
      ratingClause = `AND u.average_rating >= $${params.length}`;
    }

    const query = `
      SELECT DISTINCT
        u.id,
        u.pseudo,
        u.bio,
        u.photo_url,
        u.average_rating,
        u.exchange_count,
        (
          SELECT json_agg(json_build_object(
            'skill_id', us2.skill_id,
            'skill_name', s2.name,
            'type', us2.type,
            'level', us2.level
          ))
          FROM user_skills us2
          JOIN skills s2 ON s2.id = us2.skill_id
          WHERE us2.user_id = u.id
        ) AS skills,
        (
          SELECT COUNT(*) FROM availabilities a WHERE a.user_id = u.id
        ) AS availability_slots
      FROM users u
      JOIN user_skills us ON us.user_id = u.id
      JOIN skills s       ON s.id = us.skill_id
      WHERE s.name ILIKE $1
        AND us.type = 'offered'
        AND u.id != $2
        ${ratingClause}
      ORDER BY u.average_rating DESC NULLS LAST, u.exchange_count DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const result = await pool.query(query, params);

    // Count for pagination meta
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      JOIN user_skills us ON us.user_id = u.id
      JOIN skills s       ON s.id = us.skill_id
      WHERE s.name ILIKE $1
        AND us.type = 'offered'
        AND u.id != $2
        ${ratingClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    return success(res, result.rows, 200, {
      pagination: { total, limit: safeLimit, offset: safeOffset },
    });
  } catch (err) {
    logger.error('searchUsers error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { searchUsers };

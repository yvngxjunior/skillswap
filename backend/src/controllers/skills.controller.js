const pool = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// ─── Referential ─────────────────────────────────────────────────────────────

async function listSkills(req, res) {
  const { category, q } = req.query;
  try {
    let query = 'SELECT id, name, category FROM skills';
    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY category, name';

    const result = await pool.query(query, params);
    return success(res, result.rows);
  } catch (err) {
    logger.error('listSkills error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

// ─── User Skills ─────────────────────────────────────────────────────────────

async function getUserSkills(req, res) {
  const userId = req.params.userId || req.user.id;
  try {
    const result = await pool.query(
      `SELECT us.id, us.type, us.level,
              s.id AS skill_id, s.name AS skill_name, s.category
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = $1
       ORDER BY us.type, s.name`,
      [userId]
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('getUserSkills error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

async function addUserSkill(req, res) {
  const userId = req.user.id;
  const { skill_id, type, level } = req.body;

  try {
    // Verify skill exists
    const skillCheck = await pool.query('SELECT id FROM skills WHERE id = $1', [skill_id]);
    if (skillCheck.rowCount === 0) {
      return error(res, 404, 'NOT_FOUND', 'Skill not found.');
    }

    const result = await pool.query(
      `INSERT INTO user_skills (user_id, skill_id, type, level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, skill_id, type) DO UPDATE SET level = EXCLUDED.level
       RETURNING id, skill_id, type, level`,
      [userId, skill_id, type, level]
    );
    return success(res, result.rows[0], 201);
  } catch (err) {
    logger.error('addUserSkill error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

async function removeUserSkill(req, res) {
  const userId = req.user.id;
  const { userSkillId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM user_skills WHERE id = $1 AND user_id = $2 RETURNING id',
      [userSkillId, userId]
    );
    if (result.rowCount === 0) {
      return error(res, 404, 'NOT_FOUND', 'User skill not found or not yours.');
    }
    return res.status(204).send(); // 204 No Content per senior-backend skill
  } catch (err) {
    logger.error('removeUserSkill error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listSkills, getUserSkills, addUserSkill, removeUserSkill };

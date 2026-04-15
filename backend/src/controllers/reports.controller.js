'use strict';

const { z }  = require('zod');
const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// ── Validation ───────────────────────────────────────────────────────────
const createReportSchema = z.object({
  target_type: z.enum(['user', 'exchange', 'message']),
  target_id:   z.string().uuid(),
  reason:      z.enum(['spam', 'inappropriate', 'harassment', 'other']),
  comment:     z.string().max(300).optional(),
});

// ── Controllers ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/reports
 * Any authenticated user can file a report.
 * Rate-limited to 5/day per user (enforced by reportLimiter middleware).
 * Self-reporting is rejected with 422.
 */
async function createReport(req, res) {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message);
  }

  const { target_type, target_id, reason, comment } = parsed.data;
  const reporterId = req.user.id;

  // Prevent self-reporting
  if (target_type === 'user' && target_id === reporterId) {
    return error(res, 422, 'SELF_REPORT', 'You cannot report yourself.');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
       RETURNING id`,
      [reporterId, target_type, target_id, reason, comment ?? null]
    );

    if (rows.length === 0) {
      return error(res, 409, 'DUPLICATE_REPORT', 'You have already reported this item.');
    }

    logger.info('report.created', { reportId: rows[0].id, reporterId, target_type, target_id });
    return success(res, { id: rows[0].id }, 201);
  } catch (err) {
    logger.error('reports.createReport error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { createReport };

'use strict';

const { z }  = require('zod');
const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { createNotification } = require('../services/notification.service');

// ── Validation ────────────────────────────────────────────────────────────
const updateReportSchema = z.object({
  status:     z.enum(['reviewed', 'dismissed']),
  admin_note: z.string().max(1000).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

function parsePage(query) {
  const p = parseInt(query.page, 10);
  return p > 0 ? p : 1;
}

// ── Controllers ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/reports
 * List reports with optional filters: ?status=pending&target_type=user&page=1
 */
async function listReports(req, res) {
  const { status, target_type } = req.query;
  const page   = parsePage(req.query);
  const offset = (page - 1) * PAGE_SIZE;

  const params  = [];
  const filters = ['1=1'];

  if (status) {
    params.push(status);
    filters.push(`r.status = $${params.length}`);
  }
  if (target_type) {
    params.push(target_type);
    filters.push(`r.target_type = $${params.length}`);
  }

  params.push(PAGE_SIZE, offset);

  try {
    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT
           r.id,
           r.reporter_id,
           u.email        AS reporter_email,
           r.target_type,
           r.target_id,
           r.reason,
           r.comment,
           r.status,
           r.admin_note,
           r.created_at,
           r.updated_at
         FROM reports r
         JOIN users u ON u.id = r.reporter_id
         WHERE ${filters.join(' AND ')}
         ORDER BY r.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM reports r WHERE ${filters.slice(0, -0).join(' AND ')}`,
        params.slice(0, -2)
      ),
    ]);

    return success(res, rows.rows, 200, {
      page,
      perPage: PAGE_SIZE,
      total: parseInt(countRow.rows[0].count, 10),
    });
  } catch (err) {
    logger.error('moderation.listReports error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/admin/reports/:id
 * Update report status to 'reviewed' or 'dismissed', with optional admin_note.
 */
async function updateReport(req, res) {
  const { id } = req.params;
  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message);
  }

  const { status, admin_note } = parsed.data;

  try {
    const { rows } = await pool.query(
      `UPDATE reports
       SET status = $1, admin_note = COALESCE($2, admin_note), updated_at = NOW()
       WHERE id = $3
       RETURNING id, status, admin_note, updated_at`,
      [status, admin_note ?? null, id]
    );

    if (rows.length === 0) {
      return error(res, 404, 'NOT_FOUND', 'Report not found.');
    }

    logger.info('report.updated', { reportId: id, status });
    return success(res, rows[0]);
  } catch (err) {
    logger.error('moderation.updateReport error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Soft-delete a user: sets deleted_at, revokes all refresh tokens.
 * Soft-deleted users cannot log in and their profile returns 404.
 */
async function softDeleteUser(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (rows.length === 0) {
      return error(res, 404, 'NOT_FOUND', 'User not found or already deleted.');
    }

    // Revoke all refresh tokens for this user
    await pool.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1`,
      [id]
    );

    logger.info('admin.softDeleteUser', { targetUserId: id, adminId: req.user.id });
    return success(res, { deleted: true });
  } catch (err) {
    logger.error('moderation.softDeleteUser error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * DELETE /api/v1/admin/exchanges/:id
 * Soft-delete an exchange: sets deleted_at, notifies both participants.
 */
async function softDeleteExchange(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE exchanges
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, requester_id, provider_id`,
      [id]
    );

    if (rows.length === 0) {
      return error(res, 404, 'NOT_FOUND', 'Exchange not found or already deleted.');
    }

    const { id: exchangeId, requester_id, provider_id } = rows[0];

    // Notify both participants (fire-and-forget)
    const payload = { exchangeId, reason: 'moderation' };
    createNotification({ userId: requester_id, type: 'exchange_cancelled', payload }).catch(() => {});
    createNotification({ userId: provider_id,  type: 'exchange_cancelled', payload }).catch(() => {});

    logger.info('admin.softDeleteExchange', { exchangeId, adminId: req.user.id });
    return success(res, { deleted: true });
  } catch (err) {
    logger.error('moderation.softDeleteExchange error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listReports, updateReport, softDeleteUser, softDeleteExchange };

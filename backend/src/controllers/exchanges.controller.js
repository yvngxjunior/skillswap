'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const { computeCompatibilityScore } = require('../services/matching.service');
const { applyExchangeCredits, hasEnoughCredits } = require('../services/credits.service');
const { createNotification } = require('../services/notification.service');
const { checkAndAwardBadges } = require('../services/badge.service');
const logger = require('../utils/logger');

// ─── CREATE ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/exchanges
 * Create a new exchange request. Emits `exchange_request` notification to partner.
 */
async function createExchange(req, res) {
  const requesterId = req.user.id;
  const { partner_id, skill_id, duration_minutes, desired_date, message } = req.body;

  if (requesterId === partner_id) {
    return error(res, 400, 'INVALID_REQUEST', 'You cannot request an exchange with yourself.');
  }

  const enough = await hasEnoughCredits(requesterId).catch(() => false);
  if (!enough) {
    return error(res, 400, 'INSUFFICIENT_CREDITS', 'You need at least 1 credit to request an exchange.');
  }

  try {
    const [requesterSlots, partnerSlots, requesterWanted, partnerOffered] = await Promise.all([
      pool.query('SELECT day_of_week FROM availabilities WHERE user_id = $1', [requesterId]),
      pool.query('SELECT day_of_week FROM availabilities WHERE user_id = $1', [partner_id]),
      pool.query(`SELECT us.level FROM user_skills us WHERE us.user_id = $1 AND us.skill_id = $2 AND us.type = 'wanted'`, [requesterId, skill_id]),
      pool.query(`SELECT us.level, u.average_rating, u.exchange_count
                  FROM user_skills us JOIN users u ON u.id = us.user_id
                  WHERE us.user_id = $1 AND us.skill_id = $2 AND us.type = 'offered'`, [partner_id, skill_id]),
    ]);

    const wantedLevel = requesterWanted.rows[0]?.level || 'beginner';
    const offeredData = partnerOffered.rows[0] || {};
    const score = computeCompatibilityScore({
      wantedLevel,
      offeredLevel:     offeredData.level         || 'beginner',
      requesterSlots:   requesterSlots.rows,
      partnerSlots:     partnerSlots.rows,
      partnerRating:    offeredData.average_rating || null,
      partnerExchanges: offeredData.exchange_count || 0,
    });

    const result = await pool.query(
      `INSERT INTO exchanges
         (requester_id, partner_id, skill_id, duration_minutes, desired_date, message, compatibility_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [requesterId, partner_id, skill_id, duration_minutes || 60, desired_date || null, message || '', score]
    );
    const exchange = result.rows[0];

    // Notify partner of incoming request
    createNotification({
      userId:  partner_id,
      type:    'exchange_request',
      payload: {
        exchangeId:      exchange.id,
        requesterPseudo: req.user.pseudo,
        skillId:         skill_id,
      },
    }).catch(err => logger.warn('notification failed', { error: err.message }));

    return success(res, exchange, 201);
  } catch (err) {
    logger.error('createExchange error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

// ─── LIST ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/exchanges
 * List exchanges for the authenticated user. Supports ?status and ?role filters.
 */
async function listExchanges(req, res) {
  const userId = req.user.id;
  const { status, role } = req.query;

  let condition = '(e.requester_id = $1 OR e.partner_id = $1)';
  if (role === 'sent')     condition = 'e.requester_id = $1';
  if (role === 'received') condition = 'e.partner_id = $1';

  let statusClause = '';
  const params = [userId];
  if (status) {
    params.push(status);
    statusClause = `AND e.status = $${params.length}`;
  }

  try {
    const result = await pool.query(
      `SELECT
         e.*,
         s.name AS skill_name,
         json_build_object('id', r.id, 'pseudo', r.pseudo, 'photo_url', r.photo_url, 'average_rating', r.average_rating) AS requester,
         json_build_object('id', p.id, 'pseudo', p.pseudo, 'photo_url', p.photo_url, 'average_rating', p.average_rating) AS partner
       FROM exchanges e
       JOIN skills s ON s.id = e.skill_id
       JOIN users  r ON r.id = e.requester_id
       JOIN users  p ON p.id = e.partner_id
       WHERE ${condition} ${statusClause}
       ORDER BY e.created_at DESC`,
      params
    );
    return success(res, result.rows);
  } catch (err) {
    logger.error('listExchanges error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

// ─── GET ONE ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/exchanges/:exchangeId
 * Fetch a single exchange the authenticated user participates in.
 */
async function getExchange(req, res) {
  const userId = req.user.id;
  const { exchangeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT e.*, s.name AS skill_name,
              json_build_object('id', r.id, 'pseudo', r.pseudo, 'photo_url', r.photo_url) AS requester,
              json_build_object('id', p.id, 'pseudo', p.pseudo, 'photo_url', p.photo_url) AS partner
       FROM exchanges e
       JOIN skills s ON s.id = e.skill_id
       JOIN users  r ON r.id = e.requester_id
       JOIN users  p ON p.id = e.partner_id
       WHERE e.id = $1 AND (e.requester_id = $2 OR e.partner_id = $2)`,
      [exchangeId, userId]
    );
    if (result.rowCount === 0) return error(res, 404, 'NOT_FOUND', 'Exchange not found.');
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('getExchange error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

// ─── RESPOND (accept / cancel) ────────────────────────────────────────

/**
 * PATCH /api/v1/exchanges/:exchangeId/respond
 * Accept or cancel an exchange. Emits exchange_accepted / exchange_cancelled notification.
 */
async function respondExchange(req, res) {
  const userId = req.user.id;
  const { exchangeId } = req.params;
  const { action } = req.body;

  if (!['accept', 'cancel'].includes(action)) {
    return error(res, 400, 'VALIDATION_ERROR', 'action must be accept or cancel.');
  }

  try {
    const exch = await pool.query('SELECT * FROM exchanges WHERE id = $1', [exchangeId]);
    if (exch.rowCount === 0) return error(res, 404, 'NOT_FOUND', 'Exchange not found.');

    const ex         = exch.rows[0];
    const isPartner   = ex.partner_id   === userId;
    const isRequester = ex.requester_id === userId;

    if (!isPartner && !isRequester) {
      return error(res, 403, 'FORBIDDEN', 'Not your exchange.');
    }
    if (ex.status !== 'pending') {
      return error(res, 400, 'INVALID_STATE', `Exchange is already ${ex.status}.`);
    }
    if (action === 'accept' && !isPartner) {
      return error(res, 403, 'FORBIDDEN', 'Only the partner can accept.');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'cancelled';
    const result = await pool.query(
      'UPDATE exchanges SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, exchangeId]
    );
    const updated = result.rows[0];

    // Notify the other participant
    const notifyUserId = isPartner ? ex.requester_id : ex.partner_id;
    const notifType    = action === 'accept' ? 'exchange_accepted' : 'exchange_cancelled';
    createNotification({
      userId:  notifyUserId,
      type:    notifType,
      payload: { exchangeId, actorPseudo: req.user.pseudo },
    }).catch(err => logger.warn('notification failed', { error: err.message }));

    return success(res, updated);
  } catch (err) {
    logger.error('respondExchange error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

// ─── CONFIRM COMPLETION ──────────────────────────────────────────────

/**
 * PATCH /api/v1/exchanges/:exchangeId/confirm
 * Both participants must confirm to mark exchange as completed.
 * Applies credits and checks badge eligibility for both participants.
 */
async function confirmExchange(req, res) {
  const userId = req.user.id;
  const { exchangeId } = req.params;

  const client = await pool.connect();
  // Track whether we reached the completed state so we can award badges
  // after COMMIT (badge.service uses the global pool which cannot see
  // uncommitted writes made on `client`).
  let completedParticipants = null;

  try {
    await client.query('BEGIN');

    const exch = await client.query(
      'SELECT * FROM exchanges WHERE id = $1 FOR UPDATE',
      [exchangeId]
    );
    if (exch.rowCount === 0) {
      await client.query('ROLLBACK');
      return error(res, 404, 'NOT_FOUND', 'Exchange not found.');
    }

    const ex          = exch.rows[0];
    const isRequester = ex.requester_id === userId;
    const isPartner   = ex.partner_id   === userId;

    if (!isRequester && !isPartner) {
      await client.query('ROLLBACK');
      return error(res, 403, 'FORBIDDEN', 'Not your exchange.');
    }
    if (ex.status !== 'accepted') {
      await client.query('ROLLBACK');
      return error(res, 400, 'INVALID_STATE', 'Exchange must be accepted before confirming.');
    }

    const updateField = isRequester ? 'confirmed_by_requester' : 'confirmed_by_partner';
    const updated = await client.query(
      `UPDATE exchanges SET ${updateField} = TRUE WHERE id = $1 RETURNING *`,
      [exchangeId]
    );
    const updatedEx = updated.rows[0];

    if (updatedEx.confirmed_by_requester && updatedEx.confirmed_by_partner) {
      await client.query(
        "UPDATE exchanges SET status = 'completed' WHERE id = $1",
        [exchangeId]
      );
      updatedEx.status = 'completed';
      await applyExchangeCredits(client, ex.partner_id, ex.requester_id);

      // Notify both participants that exchange is completed (fire-and-forget)
      const notifPayload = { exchangeId };
      createNotification({ userId: ex.requester_id, type: 'exchange_completed', payload: notifPayload })
        .catch(err => logger.warn('notification failed', { error: err.message }));
      createNotification({ userId: ex.partner_id, type: 'exchange_completed', payload: notifPayload })
        .catch(err => logger.warn('notification failed', { error: err.message }));

      // Remember participants so we can check badges after COMMIT.
      // We MUST NOT call checkAndAwardBadges here — it uses the global pool
      // (a different connection) which cannot read the uncommitted status update.
      completedParticipants = [ex.requester_id, ex.partner_id];
    }

    await client.query('COMMIT');

    // Now that COMMIT is done the completed status is visible to all connections.
    // Award badges synchronously so the HTTP response is only returned after
    // user_badges rows exist (tests read the profile immediately after this call).
    if (completedParticipants) {
      await Promise.all(completedParticipants.map(id => checkAndAwardBadges(id)));
    }

    return success(res, updatedEx);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('confirmExchange error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  } finally {
    client.release();
  }
}

module.exports = { createExchange, listExchanges, getExchange, respondExchange, confirmExchange };

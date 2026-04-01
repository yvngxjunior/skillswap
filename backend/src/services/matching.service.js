/**
 * Compatibility score calculator — Sprint 3
 *
 * Scoring breakdown (max 100):
 *   40 pts — skill level compatibility (how well levels match)
 *   30 pts — shared availability slots
 *   20 pts — partner's average rating (normalised)
 *   10 pts — partner's exchange count (experience signal, capped at 10)
 */

const LEVEL_ORDER = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };

/**
 * levelCompatibility: +40 if levels are close, less if gap is large.
 * Requester wants to learn at `wantedLevel`, partner offers at `offeredLevel`.
 * Perfect match = exact or one step above (partner slightly better is ideal).
 */
function levelScore(offeredLevel, wantedLevel) {
  const off = LEVEL_ORDER[offeredLevel] || 1;
  const wan = LEVEL_ORDER[wantedLevel]  || 1;
  const gap = Math.abs(off - wan);
  if (gap === 0) return 40;
  if (gap === 1) return 30;
  if (gap === 2) return 15;
  return 5;
}

/**
 * availabilityScore: count overlapping day slots between requester and partner.
 * Max 30 pts (3 pts per shared slot, capped at 10 slots).
 */
function availabilityScore(requesterSlots, partnerSlots) {
  const partnerDays = new Set(partnerSlots.map((s) => s.day_of_week));
  const sharedDays = requesterSlots.filter((s) => partnerDays.has(s.day_of_week)).length;
  return Math.min(sharedDays * 3, 30);
}

/**
 * ratingScore: normalise average_rating (1–5) to 0–20 pts.
 */
function ratingScore(averageRating) {
  if (!averageRating) return 10; // No reviews yet: neutral 10 pts
  return Math.round(((averageRating - 1) / 4) * 20);
}

/**
 * experienceScore: 1 pt per exchange, capped at 10.
 */
function experienceScore(exchangeCount) {
  return Math.min(exchangeCount || 0, 10);
}

/**
 * Main function: compute a compatibility score [0–100] between requester and partner
 * for a given skill.
 *
 * @param {object} params
 * @param {string} params.wantedLevel      - level requester is looking for
 * @param {string} params.offeredLevel     - level partner offers
 * @param {Array}  params.requesterSlots   - requester's availability rows
 * @param {Array}  params.partnerSlots     - partner's availability rows
 * @param {number} params.partnerRating    - partner's average_rating (or null)
 * @param {number} params.partnerExchanges - partner's exchange_count
 * @returns {number} score 0–100
 */
function computeCompatibilityScore({
  wantedLevel,
  offeredLevel,
  requesterSlots,
  partnerSlots,
  partnerRating,
  partnerExchanges,
}) {
  return (
    levelScore(offeredLevel, wantedLevel) +
    availabilityScore(requesterSlots, partnerSlots) +
    ratingScore(partnerRating) +
    experienceScore(partnerExchanges)
  );
}

module.exports = { computeCompatibilityScore };

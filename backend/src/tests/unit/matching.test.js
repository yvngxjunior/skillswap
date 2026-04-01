'use strict';

const { computeCompatibilityScore } = require('../../services/matching.service');

const makeSlots = (days) => days.map((d) => ({ day_of_week: d }));

describe('computeCompatibilityScore', () => {
  const base = {
    wantedLevel:      'intermediate',
    offeredLevel:     'intermediate',
    requesterSlots:   makeSlots([1, 2, 3]),
    partnerSlots:     makeSlots([1, 2, 3]),
    partnerRating:    null,
    partnerExchanges: 0,
  };

  describe('levelScore', () => {
    it('exact match => 40 pts', () => {
      // 40 + 9 (3 slots x3) + 10 (neutral) + 0 = 59
      expect(computeCompatibilityScore({ ...base })).toBe(59);
    });

    it('gap of 1 => 30 pts', () => {
      // 30 + 9 + 10 + 0 = 49
      expect(computeCompatibilityScore({ ...base, offeredLevel: 'advanced' })).toBe(49);
    });

    it('gap of 2 => 15 pts', () => {
      // 15 + 9 + 10 + 0 = 34
      expect(computeCompatibilityScore({ ...base, offeredLevel: 'expert', wantedLevel: 'beginner' })).toBe(34);
    });

    it('gap of 3 => 5 pts', () => {
      // 5 + 0 + 10 + 0 = 15
      expect(computeCompatibilityScore({ ...base, offeredLevel: 'expert', wantedLevel: 'beginner', partnerSlots: [], requesterSlots: [] })).toBe(15);
    });
  });

  describe('availabilityScore', () => {
    it('no shared slots => 0 pts', () => {
      // 40 + 0 + 10 + 0 = 50
      expect(computeCompatibilityScore({ ...base, requesterSlots: makeSlots([4, 5]), partnerSlots: makeSlots([1, 2]) })).toBe(50);
    });

    it('10+ shared slots => capped at 30 pts', () => {
      // 40 + 30 + 10 + 0 = 80
      expect(computeCompatibilityScore({
        ...base,
        requesterSlots: makeSlots([0, 1, 2, 3, 4, 5, 6]),
        partnerSlots:   makeSlots([0, 1, 2, 3, 4, 5, 6]),
      })).toBe(80);
    });
  });

  describe('ratingScore', () => {
    it('rating 5 => 20 pts', () => {
      // 40 + 0 + 20 + 0 = 60
      expect(computeCompatibilityScore({ ...base, partnerRating: 5, requesterSlots: [], partnerSlots: [] })).toBe(60);
    });

    it('rating 1 => 0 pts', () => {
      // 40 + 0 + 0 + 0 = 40
      expect(computeCompatibilityScore({ ...base, partnerRating: 1, requesterSlots: [], partnerSlots: [] })).toBe(40);
    });

    it('no rating => neutral 10 pts', () => {
      // 40 + 0 + 10 + 0 = 50
      expect(computeCompatibilityScore({ ...base, requesterSlots: [], partnerSlots: [] })).toBe(50);
    });
  });

  describe('experienceScore', () => {
    it('5 exchanges => 5 pts', () => {
      // 40 + 0 + 10 + 5 = 55
      expect(computeCompatibilityScore({ ...base, partnerExchanges: 5, requesterSlots: [], partnerSlots: [] })).toBe(55);
    });

    it('999 exchanges => capped at 10 pts', () => {
      // 40 + 0 + 10 + 10 = 60
      expect(computeCompatibilityScore({ ...base, partnerExchanges: 999, requesterSlots: [], partnerSlots: [] })).toBe(60);
    });

    it('null exchange count => 0 pts', () => {
      // 40 + 0 + 10 + 0 = 50
      expect(computeCompatibilityScore({ ...base, partnerExchanges: null, requesterSlots: [], partnerSlots: [] })).toBe(50);
    });
  });

  it('perfect partner => 100 pts', () => {
    expect(computeCompatibilityScore({
      wantedLevel:      'intermediate',
      offeredLevel:     'intermediate',
      requesterSlots:   makeSlots([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      partnerSlots:     makeSlots([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      partnerRating:    5,
      partnerExchanges: 10,
    })).toBe(100);
  });
});

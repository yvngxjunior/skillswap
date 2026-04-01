'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const { recalculateAverageRating } = require('../../services/reviews.service');

describe('reviews.service unit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries AVG and updates user with the returned avg', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ avg: '4.50' }] })
        .mockResolvedValueOnce({}),
    };
    const result = await recalculateAverageRating(client, 'user-1');
    expect(result).toBe('4.50');
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][1]).toEqual(['4.50', 'user-1']);
  });

  it('returns null and updates with null when no reviews exist', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ avg: null }] })
        .mockResolvedValueOnce({}),
    };
    const result = await recalculateAverageRating(client, 'user-1');
    expect(result).toBeNull();
    expect(client.query.mock.calls[1][1]).toEqual([null, 'user-1']);
  });
});

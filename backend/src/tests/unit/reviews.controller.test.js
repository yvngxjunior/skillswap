'use strict';

jest.mock('../../database/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
jest.mock('../../services/reviews.service', () => ({
  recalculateAverageRating: jest.fn().mockResolvedValue('4.50'),
}));

const pool = require('../../database/db');
const { createReview, getUserReviews } = require('../../controllers/reviews.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeClient(queryImpl) {
  return { query: queryImpl, release: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('createReview', () => {
  const baseReq = {
    user: { id: 'reviewer-id' },
    params: { exchangeId: 'ex-1' },
    body: { punctuality: 5, pedagogy: 5, respect: 5, overall: 5, comment: 'Great!' },
  };

  it('returns 404 when exchange does not exist', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})                         // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })  // exchange lookup
        .mockResolvedValueOnce({})                         // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not a participant', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})  // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'other', partner_id: 'other2', status: 'completed' }] })
        .mockResolvedValueOnce({})  // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when exchange is not completed', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})  // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'reviewer-id', partner_id: 'p2', status: 'accepted' }] })
        .mockResolvedValueOnce({})  // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 201 with new review and updated average on success', async () => {
    const reviewRow = { id: 'r1', overall: 5 };
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})  // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'reviewer-id', partner_id: 'p2', status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [reviewRow] })  // INSERT review
        .mockResolvedValueOnce({})                     // COMMIT
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ review: reviewRow, reviewee_new_average: '4.50' }) })
    );
  });

  it('returns 409 on unique constraint violation', async () => {
    const dupErr = Object.assign(new Error('dup'), { code: '23505' });
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})  // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'reviewer-id', partner_id: 'p2', status: 'completed' }] })
        .mockRejectedValueOnce(dupErr)  // INSERT throws
        .mockResolvedValueOnce({})      // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on unexpected DB error', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})  // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'reviewer-id', partner_id: 'p2', status: 'completed' }] })
        .mockRejectedValueOnce(new Error('db fail'))  // INSERT throws
        .mockResolvedValueOnce({})                    // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await createReview(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUserReviews', () => {
  it('returns review rows for the given userId', async () => {
    const rows = [{ id: 'r1', overall: 4 }];
    pool.query.mockResolvedValueOnce({ rows });
    const req = { params: { userId: 'u1' }, query: {} };
    const res = makeRes();
    await getUserReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: rows }));
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await getUserReviews({ params: { userId: 'u1' }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

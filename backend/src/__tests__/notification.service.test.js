'use strict';

/**
 * Unit tests for src/services/notification.service.js (the older service
 * that also handles Expo push and Socket.io delivery).
 */

jest.mock('../database/db', () => ({
  query: jest.fn(),
}));

const pool = require('../database/db');
const { setIo, createNotification } = require('../services/notification.service');

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000002';
const FAKE_ROW = {
  id:         '00000000-0000-0000-0000-000000000088',
  user_id:    FAKE_USER_ID,
  type:       'new_message',
  payload:    {},
  read_at:    null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: insert succeeds, expo-token lookup returns nothing
  pool.query
    .mockResolvedValueOnce({ rows: [FAKE_ROW] })
    .mockResolvedValue({ rows: [] });
});

describe('notification.service', () => {
  describe('setIo()', () => {
    it('accepts a socket.io instance without throwing', () => {
      const fakeIo = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
      expect(() => setIo(fakeIo)).not.toThrow();
      setIo(null);
    });
  });

  describe('createNotification()', () => {
    it('persists a notification and returns the row', async () => {
      const result = await createNotification({
        userId:  FAKE_USER_ID,
        type:    'new_message',
        payload: { senderPseudo: 'alice' },
      });
      expect(result).toEqual(FAKE_ROW);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([FAKE_USER_ID, 'new_message'])
      );
    });

    it('emits via socket.io when io instance is set', async () => {
      const emitFn = jest.fn();
      const toFn   = jest.fn().mockReturnValue({ emit: emitFn });
      setIo({ to: toFn });

      await createNotification({ userId: FAKE_USER_ID, type: 'new_review' });

      expect(toFn).toHaveBeenCalledWith(`user:${FAKE_USER_ID}`);
      expect(emitFn).toHaveBeenCalledWith('notification', FAKE_ROW);
      setIo(null);
    });

    it('resolves without socket when io is null', async () => {
      setIo(null);
      const result = await createNotification({ userId: FAKE_USER_ID, type: 'exchange_cancelled' });
      expect(result).toEqual(FAKE_ROW);
    });

    it('rethrows DB errors', async () => {
      // Reset all queued mocks so the rejection is first, not second
      pool.query.mockReset();
      pool.query.mockRejectedValueOnce(new Error('db down'));

      await expect(
        createNotification({ userId: FAKE_USER_ID, type: 'new_message' })
      ).rejects.toThrow('db down');
    });
  });
});

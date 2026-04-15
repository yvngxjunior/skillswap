'use strict';

/**
 * Unit tests for src/services/notifications.service.js
 * Exercises setIo() and notify() which are never called by HTTP tests.
 */

jest.mock('../database/db', () => ({
  query: jest.fn(),
}));

const pool               = require('../database/db');
const { setIo, notify }  = require('../services/notifications.service');

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_ROW     = {
  id:         '00000000-0000-0000-0000-000000000099',
  user_id:    FAKE_USER_ID,
  type:       'new_message',
  payload:    {},
  read_at:    null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [FAKE_ROW] });
});

describe('notifications.service', () => {
  describe('setIo()', () => {
    it('accepts a socket.io instance without throwing', () => {
      const fakeIo = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
      expect(() => setIo(fakeIo)).not.toThrow();
    });

    it('accepts null to clear the io reference', () => {
      expect(() => setIo(null)).not.toThrow();
    });
  });

  describe('notify()', () => {
    it('inserts a notification row and returns it', async () => {
      const result = await notify({ userId: FAKE_USER_ID, type: 'new_message', payload: { foo: 1 } });
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual(FAKE_ROW);
    });

    it('emits to the user socket room when io is set', async () => {
      const emitMock = jest.fn();
      const toMock   = jest.fn().mockReturnValue({ emit: emitMock });
      setIo({ to: toMock });

      await notify({ userId: FAKE_USER_ID, type: 'new_message' });

      expect(toMock).toHaveBeenCalledWith(`user:${FAKE_USER_ID}`);
      expect(emitMock).toHaveBeenCalledWith('notification', FAKE_ROW);

      setIo(null); // reset
    });

    it('still resolves when io is not set', async () => {
      setIo(null);
      const result = await notify({ userId: FAKE_USER_ID, type: 'new_message' });
      expect(result).toEqual(FAKE_ROW);
    });

    it('uses a provided pg client instead of the pool', async () => {
      const clientQueryMock = jest.fn().mockResolvedValue({ rows: [FAKE_ROW] });
      const fakeClient = { query: clientQueryMock };

      const result = await notify({ userId: FAKE_USER_ID, type: 'new_review', client: fakeClient });

      expect(clientQueryMock).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
      expect(result).toEqual(FAKE_ROW);
    });
  });
});

'use strict';

process.env.JWT_SECRET = 'test_secret_key_for_jest';

const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../../utils/jwt');

describe('JWT utils', () => {
  describe('generateAccessToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateAccessToken({ id: 'user-uuid', email: 'a@b.com' });
      expect(typeof token).toBe('string');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe('user-uuid');
      expect(decoded.email).toBe('a@b.com');
    });

    it('should expire according to JWT_ACCESS_EXPIRES env var', () => {
      process.env.JWT_ACCESS_EXPIRES = '1s';
      const token = generateAccessToken({ id: 'u1' });
      const decoded = jwt.decode(token);
      expect(decoded.exp - decoded.iat).toBe(1);
      delete process.env.JWT_ACCESS_EXPIRES;
    });

    it('should throw if JWT_SECRET is missing', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => generateAccessToken({ id: 'x' })).toThrow();
      process.env.JWT_SECRET = saved;
    });
  });

  describe('generateRefreshToken', () => {
    it('should return a 128-character hex string', () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(128);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should be unique across consecutive calls', () => {
      const t1 = generateRefreshToken();
      const t2 = generateRefreshToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashToken', () => {
    it('should return a 64-character hex SHA-256 digest', () => {
      const hash = hashToken('my-refresh-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic for the same input', () => {
      expect(hashToken('same-token')).toBe(hashToken('same-token'));
    });

    it('different inputs should produce different hashes', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });
});

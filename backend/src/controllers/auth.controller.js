const bcrypt = require('bcrypt');
const pool = require('../database/db');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/jwt');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;
const MIN_AGE_YEARS = 15;

function calcAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

async function register(req, res) {
  const { email, password, pseudo, birth_date, cgu_accepted } = req.body;

  if (calcAge(birth_date) < MIN_AGE_YEARS) {
    return res.status(400).json({ error: `You must be at least ${MIN_AGE_YEARS} years old to register.` });
  }

  if (!cgu_accepted) {
    return res.status(400).json({ error: 'You must accept the terms and conditions.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR pseudo = $2',
      [email.toLowerCase(), pseudo]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email or pseudo already taken.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, pseudo, birth_date, cgu_accepted)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, pseudo, credit_balance, created_at`,
      [email.toLowerCase(), password_hash, pseudo, birth_date, cgu_accepted]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken({ id: user.id, pseudo: user.pseudo });
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    logger.info('New user registered', { userId: user.id });

    return success(res, {
      user: { id: user.id, email: user.email, pseudo: user.pseudo, credit_balance: user.credit_balance },
      access_token: accessToken,
      refresh_token: refreshToken,
    }, 201);
  } catch (err) {
    logger.error('Register error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      // deleted_at IS NULL: soft-deleted users must not be able to log in
      'SELECT id, email, pseudo, password_hash, credit_balance FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const accessToken = generateAccessToken({ id: user.id, pseudo: user.pseudo });
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    logger.info('User logged in', { userId: user.id });

    return success(res, {
      user: { id: user.id, email: user.email, pseudo: user.pseudo, credit_balance: user.credit_balance },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function refreshToken(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required.' });
  }

  try {
    const hashed = hashToken(refresh_token);
    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.pseudo
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND u.deleted_at IS NULL`,
      [hashed]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const row = result.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
    const newAccessToken = generateAccessToken({ id: row.user_id, pseudo: row.pseudo });
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [row.user_id, hashToken(newRefreshToken), expiresAt]
    );

    return success(res, { access_token: newAccessToken, refresh_token: newRefreshToken });
  } catch (err) {
    logger.error('Refresh token error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function logout(req, res) {
  const { refresh_token } = req.body;
  if (refresh_token) {
    const hashed = hashToken(refresh_token);
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashed]).catch(() => {});
  }
  return res.json({ message: 'Logged out.' });
}

module.exports = { register, login, refreshToken, logout };

/**
 * Environment-aware CORS configuration.
 *
 * - development: allow all origins (convenient for local Expo)
 * - test:        allow all origins
 * - production:  whitelist only ALLOWED_ORIGINS env variable
 */

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

function buildCorsOptions() {
  if (isDev || isTest) {
    return { origin: true, credentials: true };
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    console.warn('[CORS] WARNING: NODE_ENV=production but ALLOWED_ORIGINS is not set. All origins blocked.');
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  };
}

module.exports = buildCorsOptions();

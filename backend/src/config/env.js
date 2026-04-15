'use strict';

/**
 * Environment variable validation using Zod.
 * Must be imported before any other module in server.js.
 * Exits with code 1 if required vars are missing or invalid.
 */

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.string().default('3000'),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug', 'verbose', 'silly'])
    .default('info'),

  // Database — either a connection string or individual vars
  DATABASE_URL:      z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  DB_HOST:     z.string().default('localhost'),
  DB_PORT:     z.string().default('5432'),
  DB_NAME:     z.string().default('skillswap'),
  DB_USER:     z.string().default('skillswap_user'),
  DB_PASSWORD: z.string().default(''),

  // Auth
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters — use a strong random value in production'),
  JWT_ACCESS_EXPIRES:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // CORS (production only — comma-separated origins)
  ALLOWED_ORIGINS: z.string().optional(),

  // File uploads
  MAX_FILE_SIZE: z.string().default('5242880'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '[ENV] ❌  Invalid environment configuration — server will not start:\n',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  );
  process.exit(1);
}

/**
 * Validated and typed environment variables.
 * Import this instead of accessing process.env directly.
 * @type {z.infer<typeof envSchema>}
 */
module.exports = parsed.data;

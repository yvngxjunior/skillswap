const { Pool } = require('pg');

module.exports = async () => {
  // Run migrations on test DB before all tests
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_meta (ran_at TIMESTAMPTZ DEFAULT NOW())
  `);
  await pool.end();
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  global.__TEST_SERVER_PORT__ = 4001;
};

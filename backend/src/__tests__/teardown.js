const { Pool } = require('pg');

module.exports = async () => {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return;
  const pool = new Pool({ connectionString });
  await pool.query(`
    DROP TABLE IF EXISTS reviews         CASCADE;
    DROP TABLE IF EXISTS messages        CASCADE;
    DROP TABLE IF EXISTS exchanges       CASCADE;
    DROP TABLE IF EXISTS availabilities  CASCADE;
    DROP TABLE IF EXISTS user_skills     CASCADE;
    DROP TABLE IF EXISTS skills          CASCADE;
    DROP TABLE IF EXISTS refresh_tokens  CASCADE;
    DROP TABLE IF EXISTS users           CASCADE;
    DROP TABLE IF EXISTS test_meta       CASCADE;
    DROP TYPE  IF EXISTS exchange_status CASCADE;
    DROP TYPE  IF EXISTS skill_level     CASCADE;
    DROP TYPE  IF EXISTS skill_type      CASCADE;
  `);
  await pool.end();
};

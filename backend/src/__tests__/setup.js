const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });

  // Run the full schema so all tables exist before any test
  const schema = fs.readFileSync(
    path.resolve(__dirname, '../database/schema.sql'),
    'utf8'
  );
  await pool.query(schema);
  await pool.end();

  process.env.DATABASE_URL = connectionString;
  global.__TEST_SERVER_PORT__ = 4001;
};

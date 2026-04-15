const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '[globalSetup] No database URL found. Set TEST_DATABASE_URL or DATABASE_URL.'
    );
  }

  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `[globalSetup] schema.sql not found at ${schemaPath}. Make sure it is committed to the repository.`
    );
  }

  const pool = new Pool({ connectionString });

  // Run the full schema so all tables exist before any test
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  await pool.end();

  process.env.DATABASE_URL = connectionString;
  global.__TEST_SERVER_PORT__ = 4001;
};

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false });
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../db/migrations/001_initial.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database migration applied');
  } catch (err) {
    console.error('Migration failed', err.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();

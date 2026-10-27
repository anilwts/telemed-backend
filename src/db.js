const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});
pool.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'idle postgres client error', error: err.message })));
module.exports = { pool };

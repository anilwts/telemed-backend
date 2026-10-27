const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const { pool } = require('./db');
const server = app.listen(config.PORT,()=>logger.info({port:config.PORT},'telemed API listening'));
async function shutdown(signal) {
  logger.info({signal},'shutdown started');
  server.close(async()=>{ try { await pool.end(); logger.info('shutdown complete'); process.exit(0); } catch(e) { logger.error(e); process.exit(1); } });
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
module.exports = server;

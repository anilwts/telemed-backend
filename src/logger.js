const pino = require('pino');
const config = require('./config');
module.exports = pino({
  level: config.LOG_LEVEL,
  redact: { paths: ['req.headers.authorization', 'password', 'password_hash', 'mfa_secret_encrypted', '*.date_of_birth'], censor: '[REDACTED]' },
  base: { service: 'telemed-api', environment: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime
});

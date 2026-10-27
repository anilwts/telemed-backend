const { jwtVerify } = require('jose');
const config = require('../config');
const { AppError } = require('../errors');
const key = new TextEncoder().encode(config.JWT_SECRET);
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    const { payload } = await jwtVerify(header.slice(7), key, { issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE });
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token'));
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    if (!roles.includes(req.auth.role)) return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    next();
  };
}
module.exports = { authenticate, requireRole };

const { randomUUID } = require('node:crypto');
module.exports = (req, res, next) => {
  req.id = req.get('x-request-id') || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};

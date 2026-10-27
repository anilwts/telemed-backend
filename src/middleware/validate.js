const { AppError } = require('../errors');
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(new AppError(400, 'VALIDATION_ERROR', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')));
    req[source] = parsed.data;
    next();
  };
}
module.exports = { validate };

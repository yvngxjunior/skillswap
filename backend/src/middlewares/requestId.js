const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique X-Request-ID to every request.
 * If the client already sends one, we honour it (useful for tracing).
 */
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = requestId;

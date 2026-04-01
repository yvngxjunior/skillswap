const logger = require('../utils/logger');

/**
 * Structured HTTP request/response logger.
 * Replaces morgan for production — logs as JSON with request ID.
 */
function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]({
      type: 'http',
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
  });

  next();
}

module.exports = httpLogger;

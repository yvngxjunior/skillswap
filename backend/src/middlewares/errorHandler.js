const logger = require('../utils/logger');

/**
 * Centralised error handler middleware.
 * Logs unexpected errors and returns a consistent JSON response.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error({
      type: 'unhandled_error',
      requestId: req.id,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode < 500 ? err.message : 'Internal server error.',
    },
    meta: { requestId: req.id },
  });
}

module.exports = errorHandler;

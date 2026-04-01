const { v4: uuidv4 } = require('uuid');

/**
 * Standard success response: { data, meta }
 * Aligned with senior-backend skill response format.
 */
function success(res, data, statusCode = 200, extra = {}) {
  return res.status(statusCode).json({
    data,
    meta: { requestId: uuidv4(), ...extra },
  });
}

/**
 * Standard error response: { error: { code, message, details }, meta }
 */
function error(res, statusCode, code, message, details = []) {
  return res.status(statusCode).json({
    error: { code, message, details },
    meta: { requestId: uuidv4() },
  });
}

module.exports = { success, error };

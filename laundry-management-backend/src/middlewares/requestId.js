const crypto = require('crypto');

/**
 * Middleware to add request ID for tracing
 * Adds request ID to request object and response headers
 */
const requestId = (req, res, next) => {
  // Use existing request ID from header or generate new one
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

module.exports = requestId;

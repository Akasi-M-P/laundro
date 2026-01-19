const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

/**
 * Create a rate limiter that uses user ID or shop ID as key
 * Falls back to IP if user is not authenticated
 */
const createUserRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // requests
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    // Custom key generator - use user ID or shop ID if available, otherwise IP
    keyGenerator: (req) => {
      if (req.user) {
        // Use shop ID for shop-based rate limiting
        if (req.user.shopId) {
          return `shop:${req.user.shopId}`;
        }
        // Fall back to user ID
        return `user:${req.user._id}`;
      }
      // Fall back to IP address
      return req.ip || req.connection.remoteAddress;
    },
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        key: req.user ? (req.user.shopId ? `shop:${req.user.shopId}` : `user:${req.user._id}`) : req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000) // seconds
      });
    }
  });
};

/**
 * Strict rate limiter for sensitive operations (e.g., payments, order creation)
 */
const createStrictRateLimiter = (options = {}) => {
  return createUserRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 requests per 5 minutes
    message: 'Too many requests for this operation. Please slow down.',
    ...options
  });
};

/**
 * Rate limiter for OTP requests (already exists but can be enhanced)
 */
const createOTPRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Max 3 OTP requests per 15 minutes
    message: 'Too many OTP requests. Please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use phone number if available, otherwise IP
      return req.body.phoneNumber || req.ip;
    }
  });
};

module.exports = {
  createUserRateLimiter,
  createStrictRateLimiter,
  createOTPRateLimiter
};

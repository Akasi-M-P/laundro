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
    // Use standardKeyGenerator with custom logic
    // This properly handles IPv6 addresses
    keyGenerator: (req, res) => {
      if (req.user) {
        // Use shop ID for shop-based rate limiting
        if (req.user.shopId) {
          return `shop:${req.user.shopId}`;
        }
        // Fall back to user ID
        return `user:${req.user._id}`;
      }
      // Fall back to IP address - use standardKeyGenerator for IPv6 support
      // Return undefined to use default IP-based key
      return undefined;
    },
    // Skip key generation validation for custom keys
    skip: (req) => {
      // If we have a user, we're using custom key (shop/user ID)
      // Otherwise, use default IP-based limiting
      return false;
    },
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        key: req.user ? (req.user.shopId ? `shop:${req.user.shopId}` : `user:${req.user._id}`) : 'ip-based',
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
 * Rate limiter for OTP requests
 * Uses phone number as key if available, otherwise IP
 */
const createOTPRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Max 3 OTP requests per 15 minutes
    message: 'Too many OTP requests. Please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
      // Use phone number if available
      if (req.body && req.body.phoneNumber) {
        return `phone:${req.body.phoneNumber}`;
      }
      // Return undefined to use default IP-based key
      return undefined;
    }
  });
};

module.exports = {
  createUserRateLimiter,
  createStrictRateLimiter,
  createOTPRateLimiter
};

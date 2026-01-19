const express = require('express');
const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');
const { registerShop, login, requestOtp, verifyOtp } = require('../controllers/authController');
const ErrorResponse = require('../utils/errorResponse');

const router = express.Router();

// Stricter rate limiting for OTP requests (prevent abuse)
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 OTP requests per 15 minutes per IP
  message: 'Too many OTP requests. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation Middleware Helper
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const message = errors.array().map(err => err.msg).join(', ');
    next(new ErrorResponse(message, 400));
  };
};

router.post('/register-shop', validate([
    check('businessName', 'Business name is required').not().isEmpty(),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('ownerName', 'Owner name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
]), registerShop);

router.post('/login', validate([
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
]), login);

router.post('/otp-request', otpRateLimiter, validate([
    check('phoneNumber', 'Phone number is required').not().isEmpty()
]), requestOtp);

router.post('/otp-verify', validate([
    check('phoneNumber', 'Phone number is required').not().isEmpty(),
    check('otp', 'OTP is required').not().isEmpty()
]), verifyOtp);

module.exports = router;

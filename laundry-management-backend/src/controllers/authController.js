const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const { logger } = require('../utils/logger');
// Destructure enums/constants attached to models
const { UserRole } = User;
const { SubscriptionStatus } = Shop;

// Helper to sign JWT
const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d'
  });
};

/**
 * @desc    Register a new Shop and Owner
 * @route   POST /api/auth/register-shop
 * @access  Public
 */
const registerShop = asyncHandler(async (req, res, next) => {
  const { businessName, phone, location, ownerName, email, password } = req.body;

  // 1. Create Shop
  const shop = await Shop.create({
    businessName,
    phone,
    location,
    subscriptionStatus: SubscriptionStatus.ACTIVE
  });

  // 2. Create Owner User
  const user = await User.create({
    shopId: shop._id,
    name: ownerName,
    email,
    passwordHash: password,
    role: UserRole.OWNER,
    isActive: true
  });

  // 3. Generate Token
  const token = generateToken(user.id, user.role);

  res.status(201).json({
    success: true,
    data: {
      shop,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      token
    }
  });
});

/**
 * @desc    Login for Admin/Owner (Password based)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || !(await user.matchPassword(password))) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  if (!user.isActive) {
    return next(new ErrorResponse('User is deactivated', 401));
  }

  const token = generateToken(user.id, user.role);
  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    success: true,
    token
  });
});

/**
 * @desc    Request OTP for Employee Login
 * @route   POST /api/auth/otp-request
 * @access  Public
 */
const Otp = require('../models/Otp');
const { generateOtp } = require('../utils/otp');
const { logAudit } = require('../utils/logger');
const smsService = require('../services/smsService');

/**
 * @desc    Request OTP for Employee Login
 * @route   POST /api/auth/otp-request
 * @access  Public
 */
const requestOtp = asyncHandler(async (req, res, next) => {
  const { phoneNumber } = req.body;

  const user = await User.findOne({ email: phoneNumber, role: UserRole.EMPLOYEE });
  
  if (!user) {
    // Don't reveal if user exists or not (security best practice)
    return res.status(200).json({ 
      success: true, 
      message: 'If the employee exists, an OTP has been sent' 
    });
  }

  // Rate limiting: Check for recent OTP requests (within last 1 minute)
  const recentOtp = await Otp.findOne({ 
    phoneNumber, 
    createdAt: { $gte: new Date(Date.now() - 60000) } // Last 60 seconds
  });

  if (recentOtp) {
    return next(new ErrorResponse('Please wait before requesting another OTP', 429));
  }

  // Generate secure 6-digit OTP
  const otp = generateOtp();
  
  // Clear existing OTPs for this number
  await Otp.deleteMany({ phoneNumber });
  
    // Save new OTP to DB (auto-expires after 10 minutes per schema)
    await Otp.create({
      phoneNumber,
      otp
    });

    // Send OTP via SMS (non-blocking)
    let smsSent = false;
    try {
      smsSent = await smsService.sendOTP(phoneNumber, otp);
    } catch (smsError) {
      // Log SMS error but don't fail the request
      logger.error('Failed to send OTP via SMS:', smsError);
    }

    // In development, also log to console for testing
    if (process.env.NODE_ENV === 'development' && !smsSent) {
      console.log(`[DEV OTP] OTP for ${phoneNumber} is ${otp} (expires in 10 minutes)`);
    }

    // Log audit event (without OTP)
    await logAudit(user, 'OTP_REQUESTED', 'User', user._id, { phoneNumber, smsSent });

  res.json({ 
    success: true, 
    message: 'OTP sent successfully' 
  });
});

/**
 * @desc    Verify OTP and Login
 * @route   POST /api/auth/otp-verify
 * @access  Public
 */
const verifyOtp = asyncHandler(async (req, res, next) => {
  const { phoneNumber, otp } = req.body;

  // Find valid OTP
  const validOtp = await Otp.findOne({ phoneNumber, otp });

  if (validOtp) {
    const user = await User.findOne({ email: phoneNumber });
    if (!user) {
      return next(new ErrorResponse('Invalid or expired OTP', 401));
    }

    if (!user.isActive) {
      return next(new ErrorResponse('User is deactivated', 401));
    }

    const token = generateToken(user.id, user.role);
    
    // Delete used OTP (Single use)
    await Otp.deleteOne({ _id: validOtp._id });

    user.lastLoginAt = new Date();
    await user.save();

    // Log successful OTP verification
    await logAudit(user, 'OTP_VERIFIED', 'User', user._id, { phoneNumber });

    res.json({ success: true, token });
  } else {
    // Log failed OTP attempt
    const user = await User.findOne({ email: phoneNumber });
    if (user) {
      await logAudit(user, 'OTP_VERIFICATION_FAILED', 'User', user._id, { phoneNumber });
    }
    return next(new ErrorResponse('Invalid or expired OTP', 401));
  }
});

module.exports = {
  registerShop,
  login,
  requestOtp,
  verifyOtp
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');
// Destructure enums/constants attached to models
const { UserRole } = User;
const { SubscriptionStatus } = Shop;
// const { logAudit } = require('../utils/logger'); // Unused in original TS, but imported

// Helper to sign JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d'
  });
};

/**
 * @desc    Register a new Shop and Owner
 * @route   POST /api/auth/register-shop
 * @access  Public
 */
const registerShop = async (req, res) => {
  const { businessName, phone, location, ownerName, email, password } = req.body;

  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Login for Admin/Owner (Password based)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User is deactivated' });
    }

    const token = generateToken(user.id, user.role);
    user.lastLoginAt = new Date();
    await user.save();

    res.json({
      success: true,
      token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Request OTP for Employee Login
 * @route   POST /api/auth/otp-request
 * @access  Public
 */
// In-memory OTP store for MVP (Production should use Redis)
const otpStore = {}; 

const requestOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await User.findOne({ email: phoneNumber, role: UserRole.EMPLOYEE });
    
    if (!user) {
         return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Mock OTP generation
    const otp = '123456';
    otpStore[phoneNumber] = otp;

    console.log(`[MOCK OTP] OTP for ${phoneNumber} is ${otp}`);

    res.json({ success: true, message: 'OTP sent (Check console)' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify OTP and Login
 * @route   POST /api/auth/otp-verify
 * @access  Public
 */
const verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (otpStore[phoneNumber] === otp) {
    const user = await User.findOne({ email: phoneNumber });
    if (!user) return res.status(401).json({ success: false });

    const token = generateToken(user.id, user.role);
    delete otpStore[phoneNumber]; // Single use

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid OTP' });
  }
};

module.exports = {
  registerShop,
  login,
  requestOtp,
  verifyOtp
};

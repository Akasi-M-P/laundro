import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';
import Shop, { SubscriptionStatus } from '../models/Shop';
import { logAudit } from '../utils/logger';

// Helper to sign JWT
const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d'
  });
};

/**
 * @desc    Register a new Shop and Owner
 * @route   POST /api/auth/register-shop
 * @access  Public
 */
export const registerShop = async (req: Request, res: Response) => {
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

    // 4. Audit Log (System action conceptually, but we can log user creation)
    // Note: We don't have a req.user yet, so we skip audit or log as system if we had a system user.

    res.status(201).json({
      success: true,
      data: {
        shop,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

/**
 * @desc    Login for Admin/Owner (Password based)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

/**
 * @desc    Request OTP for Employee Login
 * @route   POST /api/auth/otp-request
 * @access  Public
 */
// In-memory OTP store for MVP (Production should use Redis)
const otpStore: Record<string, string> = {}; 

export const requestOtp = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body; // Assuming username or phone identifies employee

  // MVP: We need to find the user. Since spec says "Passwordless login", 
  // we assume we identify them by name+shop or unique phone. 
  // For MVP let's assume `email` field stores a unique phone-like identifier for employees OR we add a phone field to User.
  // Actually User model has optional email. Let's assume for MVP we use 'email' field to store unique username/phone string if needed.
  // OR we can search by name if unique within shop? Unsafe.
  // Let's rely on 'email' field containing a unique ID/Phone for now as per schema provided earlier.

  // NOTE: Schema has `email` as unique sparse.
  
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
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

/**
 * @desc    Verify OTP and Login
 * @route   POST /api/auth/otp-verify
 * @access  Public
 */
export const verifyOtp = async (req: Request, res: Response) => {
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

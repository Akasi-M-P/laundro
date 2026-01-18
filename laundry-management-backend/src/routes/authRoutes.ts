import express from 'express';
import { registerShop, login, requestOtp, verifyOtp } from '../controllers/authController';

const router = express.Router();

router.post('/register-shop', registerShop);
router.post('/login', login);
router.post('/otp-request', requestOtp);
router.post('/otp-verify', verifyOtp);

export default router;

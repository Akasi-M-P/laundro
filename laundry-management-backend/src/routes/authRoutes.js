const express = require('express');
const { registerShop, login, requestOtp, verifyOtp } = require('../controllers/authController');

const router = express.Router();

router.post('/register-shop', registerShop);
router.post('/login', login);
router.post('/otp-request', requestOtp);
router.post('/otp-verify', verifyOtp);

module.exports = router;

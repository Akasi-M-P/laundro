const crypto = require('crypto');

/**
 * Generates a secure 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOtp = () => {
  // Generate random 6-digit number (100000 to 999999)
  return crypto.randomInt(100000, 999999).toString();
};

module.exports = { generateOtp };

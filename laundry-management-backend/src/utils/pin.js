const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Generates a 6-digit secure PIN
 */
const generatePin = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes a PIN using bcrypt
 * @param pin 6-digit string
 */
const hashPin = async (pin) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(pin, salt);
};

/**
 * Verifies a PIN against a hash
 * @param pin Plain text PIN
 * @param hash Hashed PIN
 */
const verifyPin = async (pin, hash) => {
  return await bcrypt.compare(pin, hash);
};

module.exports = { generatePin, hashPin, verifyPin };

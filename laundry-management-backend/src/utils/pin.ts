import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Generates a 6-digit secure PIN
 */
export const generatePin = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes a PIN using bcrypt
 * @param pin 6-digit string
 */
export const hashPin = async (pin: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(pin, salt);
};

/**
 * Verifies a PIN against a hash
 * @param pin Plain text PIN
 * @param hash Hashed PIN
 */
export const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(pin, hash);
};

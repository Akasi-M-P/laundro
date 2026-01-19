const { logger } = require('../utils/logger');

/**
 * SMS Service Interface
 * This service can be implemented with various providers:
 * - Twilio
 * - AWS SNS
 * - MessageBird
 * - Custom SMS Gateway
 */

class SMSService {
  /**
   * Send SMS message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message content
   * @returns {Promise<boolean>} - Success status
   */
  async sendSMS(phoneNumber, message) {
    // This is a placeholder implementation
    // In production, replace with actual SMS provider integration
    
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // In development/test, just log the message
      logger.info(`[SMS MOCK] To: ${phoneNumber}, Message: ${message}`);
      return true;
    }

    // Production implementation would go here
    // Example with Twilio:
    /*
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    try {
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      return true;
    } catch (error) {
      logger.error('SMS sending failed:', error);
      return false;
    }
    */

    // Example with AWS SNS:
    /*
    const AWS = require('aws-sdk');
    const sns = new AWS.SNS({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    
    try {
      await sns.publish({
        PhoneNumber: phoneNumber,
        Message: message
      }).promise();
      return true;
    } catch (error) {
      logger.error('SMS sending failed:', error);
      return false;
    }
    */

    logger.warn('SMS service not configured. Message not sent.');
    return false;
  }

  /**
   * Send OTP to employee
   * @param {string} phoneNumber - Employee phone number
   * @param {string} otp - OTP code
   * @returns {Promise<boolean>}
   */
  async sendOTP(phoneNumber, otp) {
    const message = `Your Laundro login OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send pickup PIN to customer
   * @param {string} phoneNumber - Customer phone number
   * @param {string} pin - Pickup PIN
   * @param {string} orderId - Order ID (optional, for reference)
   * @returns {Promise<boolean>}
   */
  async sendPickupPIN(phoneNumber, pin, orderId = null) {
    let message = `Your Laundro pickup PIN is: ${pin}. `;
    if (orderId) {
      message += `Order ID: ${orderId}. `;
    }
    message += 'Please provide this PIN when collecting your order.';
    return await this.sendSMS(phoneNumber, message);
  }
}

// Export singleton instance
module.exports = new SMSService();

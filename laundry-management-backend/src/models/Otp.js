const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document automatically deletes after 600 seconds (10 minutes)
  }
});

// Index for fast lookup by phone
OtpSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model('Otp', OtpSchema);

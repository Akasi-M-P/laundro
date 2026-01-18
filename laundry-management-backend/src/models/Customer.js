const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomerSchema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for searching customers by phone within a shop
CustomerSchema.index({ shopId: 1, phoneNumber: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);

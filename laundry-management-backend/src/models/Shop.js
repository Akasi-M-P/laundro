const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  GRACE: 'GRACE',
  SUSPENDED: 'SUSPENDED'
};

const ShopSchema = new Schema({
  businessName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  location: { type: String, required: true },
  subscriptionStatus: { 
    type: String, 
    enum: Object.values(SubscriptionStatus), 
    default: SubscriptionStatus.ACTIVE 
  },
  suspensionReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Index for subscription status queries
ShopSchema.index({ subscriptionStatus: 1 });

const Shop = mongoose.model('Shop', ShopSchema);
module.exports = Shop;
module.exports.SubscriptionStatus = SubscriptionStatus;

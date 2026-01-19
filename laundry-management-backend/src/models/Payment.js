const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentMethod = {
  CASH: 'CASH',
  ELECTRONIC: 'ELECTRONIC'
};

const PaymentSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { 
    type: String, 
    enum: Object.values(PaymentMethod), 
    required: true 
  },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  offlineId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false }); // Schema had manual createdAt but no timestamps: true in TS

// Indexes for payment queries
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ orderId: 1, createdAt: -1 }); // Payment history for an order
PaymentSchema.index({ receivedBy: 1, createdAt: -1 }); // Payments received by user
PaymentSchema.index({ offlineId: 1 }); // For offline sync lookups

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
module.exports.PaymentMethod = PaymentMethod;

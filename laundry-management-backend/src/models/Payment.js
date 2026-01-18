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

PaymentSchema.index({ orderId: 1 });

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
module.exports.PaymentMethod = PaymentMethod;

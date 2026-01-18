import mongoose, { Document, Schema } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  ELECTRONIC = 'ELECTRONIC'
}

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  receivedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  offlineId?: string;
}

const PaymentSchema: Schema = new Schema({
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
});

PaymentSchema.index({ orderId: 1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);

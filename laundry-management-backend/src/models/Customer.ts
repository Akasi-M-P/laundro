import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  shopId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber: string;
  createdAt: Date;
}

const CustomerSchema: Schema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for searching customers by phone within a shop
CustomerSchema.index({ shopId: 1, phoneNumber: 1 });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);

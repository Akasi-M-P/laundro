import mongoose, { Document, Schema } from 'mongoose';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  GRACE = 'GRACE',
  SUSPENDED = 'SUSPENDED'
}

export interface IShop extends Document {
  businessName: string;
  phone: string;
  location: string;
  subscriptionStatus: SubscriptionStatus;
  suspensionReason?: string;
  createdAt: Date;
}

const ShopSchema: Schema = new Schema({
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

export default mongoose.model<IShop>('Shop', ShopSchema);

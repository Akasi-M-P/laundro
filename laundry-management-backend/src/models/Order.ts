import mongoose, { Document, Schema } from 'mongoose';

export enum OrderStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  COLLECTED = 'COLLECTED'
}

export interface IOrderItem {
  itemName: string;
  size: string;
  priceAtOrderTime: number;
  quantity?: number; // Normalized, though spec implied single items, typical app allows qty
  photoUrl?: string;
  note?: string;
}

export interface IOrder extends Document {
  shopId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  status: OrderStatus;
  items: IOrderItem[];
  totalAmount: number;
  amountPaid: number;
  balance: number;
  pickupPinHash?: string; // Hashed pin
  createdBy: mongoose.Types.ObjectId;
  collectedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  collectedAt?: Date;
  offlineId?: string; // For offline sync reconciliation
}

const OrderItemSchema = new Schema({
  itemName: { type: String, required: true },
  size: { type: String, required: true },
  priceAtOrderTime: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  photoUrl: { type: String },
  note: { type: String }
}, { _id: false });

const OrderSchema: Schema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  status: { 
    type: String, 
    enum: Object.values(OrderStatus), 
    default: OrderStatus.CREATED,
    required: true
  },
  items: [OrderItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0 }, // Should rely on total - paid calculation
  pickupPinHash: { type: String }, // Populated when Ready
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  collectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  collectedAt: { type: Date },
  offlineId: { type: String, unique: true, sparse: true } // UUID from client
}, {
  timestamps: true
});

// Calculate balance before saving
OrderSchema.pre<IOrder>('save', function(next) {
  this.balance = this.totalAmount - this.amountPaid;
  next();
});

OrderSchema.index({ shopId: 1, status: 1 });
OrderSchema.index({ shopId: 1, createdAt: -1 });

export default mongoose.model<IOrder>('Order', OrderSchema);

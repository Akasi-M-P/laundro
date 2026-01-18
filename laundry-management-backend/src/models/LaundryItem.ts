import mongoose, { Document, Schema } from 'mongoose';

export interface ILaundryItem extends Document {
  shopId: mongoose.Types.ObjectId;
  name: string;
  size: string; // S, M, L, XL or custom
  price: number;
  isActive: boolean;
}

const LaundryItemSchema: Schema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  size: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true }
});

// Composite index to ensure unique item name+size per shop
LaundryItemSchema.index({ shopId: 1, name: 1, size: 1 }, { unique: true });

export default mongoose.model<ILaundryItem>('LaundryItem', LaundryItemSchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const LaundryItemSchema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  size: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true }
});

// Composite index to ensure unique item name+size per shop
LaundryItemSchema.index({ shopId: 1, name: 1, size: 1 }, { unique: true });

module.exports = mongoose.model('LaundryItem', LaundryItemSchema);

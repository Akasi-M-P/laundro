const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrderStatus = {
  CREATED: "CREATED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  COLLECTED: "COLLECTED",
};

const OrderItemSchema = new Schema(
  {
    itemName: { type: String, required: true },
    size: { type: String, required: true },
    priceAtOrderTime: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    photoUrl: { type: String },
    note: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.CREATED,
      required: true,
    },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    pickupPinHash: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    collectedAt: { type: Date },
    offlineId: { type: String, unique: true, sparse: true },
  },
  {
    timestamps: true,
  },
);

// Calculate balance before saving
OrderSchema.pre("save", function (next) {
  this.balance = this.totalAmount - this.amountPaid;
  next();
});

// Indexes for common queries
OrderSchema.index({ shopId: 1, status: 1 });
OrderSchema.index({ shopId: 1, createdAt: -1 });
OrderSchema.index({ shopId: 1, customerId: 1 });
OrderSchema.index({ shopId: 1, status: 1, createdAt: -1 });

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;
module.exports.OrderStatus = OrderStatus;

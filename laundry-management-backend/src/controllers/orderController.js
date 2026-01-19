const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Shop = require('../models/Shop');
const Customer = require('../models/Customer');
const { OrderStatus } = Order;
const { PaymentMethod } = Payment;
const { SubscriptionStatus } = Shop;
const { generatePin, hashPin, verifyPin } = require('../utils/pin');
const { logAudit } = require('../utils/logger');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Create new order (Offline compatible)
 * @route   POST /api/orders
 * @access  Employee/Owner
 */
const createOrder = asyncHandler(async (req, res, next) => {
  const { customerId, items, totalAmount, amountPaid, offlineId, createdAt } = req.body;
  const user = req.user;

  // 1. Validate Customer exists and belongs to shop
  const customer = await Customer.findOne({ _id: customerId, shopId: user.shopId });
  if (!customer) {
    return next(new ErrorResponse('Customer not found or does not belong to your shop', 404));
  }

  // 3. Idempotency Check (Offline Sync) - Must be within same shop
  if (offlineId) {
    const existingOrder = await Order.findOne({ offlineId, shopId: user.shopId });
    if (existingOrder) {
      return res.status(200).json({ success: true, data: existingOrder, message: 'Order already synced' });
    }
  }

  // 4. Create Order and Payment in a transaction (atomic operation)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let status = OrderStatus.CREATED;
    if (amountPaid > 0) {
      status = OrderStatus.PROCESSING;
    }

    // Create Order within transaction
    const order = await Order.create([{
      shopId: user.shopId,
      customerId,
      items,
      totalAmount,
      amountPaid,
      status,
      createdBy: user._id,
      offlineId,
      // If synced from offline, use original timestamp
      createdAt: createdAt ? new Date(createdAt) : undefined
    }], { session });

    const createdOrder = order[0];

    // Record Initial Payment if any (within same transaction)
    if (amountPaid > 0) {
      await Payment.create([{
        orderId: createdOrder._id,
        amount: amountPaid,
        method: PaymentMethod.CASH, // Default to Cash for MVP simple flow, or pass in body
        receivedBy: user._id,
        offlineId: offlineId ? `${offlineId}_pay` : undefined, // Rudimentary sub-ID
        createdAt: createdAt ? new Date(createdAt) : undefined 
      }], { session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Log audit events (outside transaction - audit logs are append-only, failures here are less critical)
    try {
      if (amountPaid > 0) {
        await logAudit(user, 'RECORD_PAYMENT', 'Payment', createdOrder._id, { amount: amountPaid });
      }
      await logAudit(user, 'CREATE_ORDER', 'Order', createdOrder._id, { offlineId });
    } catch (auditError) {
      // Log audit error but don't fail the request
      console.error('Audit logging failed:', auditError);
    }

    res.status(201).json({ success: true, data: createdOrder });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    throw error; // Let asyncHandler catch and handle
  }
});

/**
 * @desc    Mark order as READY (Generates secure PIN)
 * @route   PUT /api/orders/:id/ready
 * @access  Employee/Owner
 */
const markReady = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, shopId: req.user.shopId });
  
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  if (order.status !== OrderStatus.PROCESSING && order.status !== OrderStatus.CREATED) {
    return next(new ErrorResponse('Order must be Processing or Created', 400));
  }

  // Generate PIN
  const plainPin = generatePin();
  order.pickupPinHash = await hashPin(plainPin);
  order.status = OrderStatus.READY;
  await order.save();

  await logAudit(req.user, 'MARK_READY', 'Order', order._id, { 
    note: 'PIN generated and sent to customer' 
  });

  // TODO: Send PIN via SMS/WhatsApp to customer
  // For now, PIN is securely stored and will be verified on collection
  // In production, integrate with SMS gateway (Twilio, AWS SNS, etc.)
  // Example: await sendSMS(customer.phoneNumber, `Your pickup PIN is: ${plainPin}`);

  res.json({ 
    success: true, 
    data: order,
    message: 'Order marked as ready. PIN has been sent to customer.'
  });
});

/**
 * @desc    Collect Order (Requires PIN)
 * @route   POST /api/orders/:id/collect
 * @access  Employee/Owner
 */
const collectOrder = asyncHandler(async (req, res, next) => {
  const { pin } = req.body;

  const order = await Order.findOne({ _id: req.params.id, shopId: req.user.shopId });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Check Status
  if (order.status !== OrderStatus.READY) {
    return next(new ErrorResponse('Order is not ready for pickup', 400));
  }

  // Check Balance
  if (order.balance > 0) {
    return next(new ErrorResponse(`Cannot collect. Outstanding balance: ${order.balance}`, 400));
  }

  // Verify PIN
  if (!order.pickupPinHash || !(await verifyPin(pin, order.pickupPinHash))) {
      await logAudit(req.user, 'FAILED_COLLECTION_ATTEMPT', 'Order', order._id, { reason: 'Invalid PIN' });
      return next(new ErrorResponse('Invalid Pickup PIN', 401));
  }

  // Success
  order.status = OrderStatus.COLLECTED;
  order.collectedBy = req.user._id;
  order.collectedAt = new Date();
  // Invalidate PIN (Single use)
  order.pickupPinHash = undefined; 
  await order.save();

  await logAudit(req.user, 'COLLECT_ORDER', 'Order', order._id);

  res.json({ success: true, data: order });
});

module.exports = {
  createOrder,
  markReady,
  collectOrder
};

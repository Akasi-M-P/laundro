const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { PaymentMethod } = Payment;
const { OrderStatus } = Order;
const { logAudit } = require('../utils/logger');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Record a new payment for an order
 * @route   POST /api/payments
 * @access  Employee/Owner
 */
const recordPayment = asyncHandler(async (req, res, next) => {
  const { orderId, amount, method, offlineId, createdAt } = req.body;
  const user = req.user;

  // Validate amount
  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return next(new ErrorResponse('Payment amount must be a positive number', 400));
  }

  const order = await Order.findOne({ _id: orderId, shopId: user.shopId });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  if (order.status === OrderStatus.COLLECTED) {
    return next(new ErrorResponse('Cannot pay for collected order', 400));
  }

  // Calculate current balance
  const currentBalance = order.totalAmount - order.amountPaid;
  
  // Validate payment doesn't exceed balance
  if (paymentAmount > currentBalance) {
    return next(new ErrorResponse(
      `Payment amount (${paymentAmount}) exceeds remaining balance (${currentBalance})`, 
      400
    ));
  }

  // Idempotency check - Must verify order belongs to shop
  if (offlineId) {
    const existingPayment = await Payment.findOne({ offlineId }).populate('orderId');
    if (existingPayment) {
      // Verify the payment's order belongs to the user's shop
      if (existingPayment.orderId.shopId.toString() === user.shopId.toString()) {
        return res.status(200).json({ success: true, data: existingPayment, message: 'Payment already synced' });
      }
      // If offlineId exists but belongs to different shop, treat as new payment
    }
  }

  // Use atomic operation to update order and prevent race conditions
  // This ensures amountPaid is updated atomically and we can check balance in the same operation
  const updatedOrder = await Order.findOneAndUpdate(
    { 
      _id: orderId, 
      shopId: user.shopId,
      status: { $ne: OrderStatus.COLLECTED }, // Ensure order is not collected
      // Ensure payment won't exceed total (atomic check)
      $expr: { $lte: [{ $add: ['$amountPaid', paymentAmount] }, '$totalAmount'] }
    },
    {
      $inc: { amountPaid: paymentAmount }, // Atomically increment amountPaid
      // Update status to PROCESSING if it was CREATED
      $set: order.status === OrderStatus.CREATED 
        ? { status: OrderStatus.PROCESSING }
        : {}
    },
    { new: true } // Return updated document
  );

  // If update failed, it means conditions weren't met (race condition or validation failed)
  if (!updatedOrder) {
    // Re-check to provide better error message
    const recheckOrder = await Order.findById(orderId);
    if (!recheckOrder) {
      return next(new ErrorResponse('Order not found', 404));
    }
    if (recheckOrder.status === OrderStatus.COLLECTED) {
      return next(new ErrorResponse('Cannot pay for collected order', 400));
    }
    const newBalance = recheckOrder.totalAmount - recheckOrder.amountPaid;
    if (paymentAmount > newBalance) {
      return next(new ErrorResponse(
        `Payment amount (${paymentAmount}) exceeds remaining balance (${newBalance})`, 
        400
      ));
    }
    // If we get here, there was a race condition - retry or return error
    return next(new ErrorResponse('Payment could not be processed. Please try again.', 409));
  }

  // Create Payment record
  const payment = await Payment.create({
    orderId,
    amount: paymentAmount,
    method: method || PaymentMethod.CASH,
    receivedBy: user._id,
    offlineId,
    createdAt: createdAt ? new Date(createdAt) : undefined
  });

  await logAudit(user, 'RECORD_PAYMENT', 'Payment', payment._id, { orderId, amount });

  res.status(201).json({ success: true, data: payment });
});

module.exports = { recordPayment };

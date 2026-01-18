const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Shop = require('../models/Shop');
const { OrderStatus } = Order;
const { PaymentMethod } = Payment;
const { SubscriptionStatus } = Shop;
const { generatePin, hashPin, verifyPin } = require('../utils/pin');
const { logAudit } = require('../utils/logger');

/**
 * @desc    Create new order (Offline compatible)
 * @route   POST /api/orders
 * @access  Employee/Owner
 */
const createOrder = async (req, res) => {
  const { customerId, items, totalAmount, amountPaid, offlineId, createdAt } = req.body;
  const user = req.user;

  try {
    // 1. Check Shop Subscription Status
    const shop = await Shop.findById(user.shopId);
    if (!shop || shop.subscriptionStatus === SubscriptionStatus.SUSPENDED) {
      return res.status(403).json({ success: false, message: 'Shop is suspended. Cannot create orders.' });
    }

    // 2. Idempotency Check (Offline Sync)
    if (offlineId) {
      const existingOrder = await Order.findOne({ offlineId });
      if (existingOrder) {
        return res.status(200).json({ success: true, data: existingOrder, message: 'Order already synced' });
      }
    }

    // 3. Create Order
    let status = OrderStatus.CREATED;
    if (amountPaid > 0) {
      status = OrderStatus.PROCESSING;
    }

    const order = await Order.create({
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
    });

    // 4. Record Initial Payment if any
    if (amountPaid > 0) {
      await Payment.create({
        orderId: order._id,
        amount: amountPaid,
        method: PaymentMethod.CASH, // Default to Cash for MVP simple flow, or pass in body
        receivedBy: user._id,
        offlineId: offlineId ? `${offlineId}_pay` : undefined, // Rudimentary sub-ID
        createdAt: createdAt ? new Date(createdAt) : undefined 
      });
      await logAudit(user, 'RECORD_PAYMENT', 'Payment', order._id, { amount: amountPaid });
    }

    await logAudit(user, 'CREATE_ORDER', 'Order', order._id, { offlineId });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Mark order as READY (Generates secure PIN)
 * @route   PUT /api/orders/:id/ready
 * @access  Employee/Owner
 */
const markReady = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, shopId: req.user.shopId });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== OrderStatus.PROCESSING && order.status !== OrderStatus.CREATED) {
      return res.status(400).json({ success: false, message: 'Order must be Processing or Created' });
    }

    // Generate PIN
    const plainPin = generatePin();
    order.pickupPinHash = await hashPin(plainPin);
    order.status = OrderStatus.READY;
    await order.save();

    await logAudit(req.user, 'MARK_READY', 'Order', order._id);

    res.json({ 
      success: true, 
      data: order, 
      _tempPin: plainPin // ONLY for demo/MVP purposes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Collect Order (Requires PIN)
 * @route   POST /api/orders/:id/collect
 * @access  Employee/Owner
 */
const collectOrder = async (req, res) => {
  const { pin } = req.body;

  try {
    const order = await Order.findOne({ _id: req.params.id, shopId: req.user.shopId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check Status
    if (order.status !== OrderStatus.READY) {
      return res.status(400).json({ success: false, message: 'Order is not ready for pickup' });
    }

    // Check Balance
    if (order.balance > 0) {
      return res.status(400).json({ success: false, message: `Cannot collect. Outstanding balance: ${order.balance}` });
    }

    // Verify PIN
    if (!order.pickupPinHash || !(await verifyPin(pin, order.pickupPinHash))) {
        await logAudit(req.user, 'FAILED_COLLECTION_ATTEMPT', 'Order', order._id, { reason: 'Invalid PIN' });
        return res.status(401).json({ success: false, message: 'Invalid Pickup PIN' });
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  markReady,
  collectOrder
};

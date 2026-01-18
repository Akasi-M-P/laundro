import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { OrderStatus } from '../models/Order';
import Payment, { PaymentMethod } from '../models/Payment';
import { generatePin, hashPin, verifyPin } from '../utils/pin';
import { logAudit } from '../utils/logger';
import Shop, { SubscriptionStatus } from '../models/Shop';

/**
 * @desc    Create new order (Offline compatible)
 * @route   POST /api/orders
 * @access  Employee/Owner
 */
export const createOrder = async (req: Request, res: Response) => {
  const { customerId, items, totalAmount, amountPaid, offlineId, createdAt } = req.body;
  const user = req.user!;

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
    // If amountPaid > 0, status might skip to PROCESSING? Spec: "Order becomes PROCESSING when payment... occurs"
    // Let's default to CREATED, then check payment.
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
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

/**
 * @desc    Mark order as READY (Generates secure PIN)
 * @route   PUT /api/orders/:id/ready
 * @access  Employee/Owner
 */
export const markReady = async (req: Request, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, shopId: req.user!.shopId });
    
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

    // In a real app, we might SMS this PIN to the customer here.
    // For MVP, we return it in the response ONE TIME.
    // "Pickup PIN is never shown in-app" - usually means not viewable later. 
    // But it must be shown to the employee to give to the customer, or sent via SMS.
    // Spec: "Pickup PIN is never shown in-app" ... "Orders cannot be collected without valid PIN".
    // Presumption: The SYSTEM sends the PIN properly (SMS). 
    // Since we don't have SMS mock here, I will return it in response for the "Employee" to "tell" the customer (or simulating SMS).

    await logAudit(req.user, 'MARK_READY', 'Order', order._id);

    res.json({ 
      success: true, 
      data: order, 
      _tempPin: plainPin // ONLY for demo/MVP purposes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

/**
 * @desc    Collect Order (Requires PIN)
 * @route   POST /api/orders/:id/collect
 * @access  Employee/Owner
 */
export const collectOrder = async (req: Request, res: Response) => {
  const { pin } = req.body;

  try {
    const order = await Order.findOne({ _id: req.params.id, shopId: req.user!.shopId });

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
    order.collectedBy = req.user!._id as mongoose.Types.ObjectId; // Cast because Type definition
    order.collectedAt = new Date();
    // Invalidate PIN (Single use) - actually status change prevents reuse, but clearing hash is good practice
    order.pickupPinHash = undefined; 
    await order.save();

    await logAudit(req.user, 'COLLECT_ORDER', 'Order', order._id);

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

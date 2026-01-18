import { Request, Response } from 'express';
import Payment, { PaymentMethod } from '../models/Payment';
import Order, { OrderStatus } from '../models/Order';
import { logAudit } from '../utils/logger';

/**
 * @desc    Record a new payment for an order
 * @route   POST /api/payments
 * @access  Employee/Owner
 */
export const recordPayment = async (req: Request, res: Response) => {
  const { orderId, amount, method, offlineId, createdAt } = req.body;
  const user = req.user!;

  try {
    const order = await Order.findOne({ _id: orderId, shopId: user.shopId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === OrderStatus.COLLECTED) {
      return res.status(400).json({ success: false, message: 'Cannot pay for collected order' });
    }

    // Idempotency check
    if (offlineId) {
      const existingPayment = await Payment.findOne({ offlineId });
      if (existingPayment) {
        return res.status(200).json({ success: true, data: existingPayment, message: 'Payment already synced' });
      }
    }

    // Create Payment
    const payment = await Payment.create({
      orderId,
      amount,
      method: method || PaymentMethod.CASH,
      receivedBy: user._id,
      offlineId,
      createdAt: createdAt ? new Date(createdAt) : undefined
    });

    // Update Order Balance and Amount Paid
    order.amountPaid += Number(amount);
    // Balance is calculated in pre-save hook of Order model: this.balance = this.totalAmount - this.amountPaid;
    
    // If order was CREATED and now has payment, likely PROCESSING?
    // Spec: "Order becomes PROCESSING when payment... occurs"
    if (order.status === OrderStatus.CREATED) {
      order.status = OrderStatus.PROCESSING;
    }
    
    await order.save();

    await logAudit(user, 'RECORD_PAYMENT', 'Payment', payment._id, { orderId, amount });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

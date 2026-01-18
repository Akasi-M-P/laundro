import { Request, Response } from 'express';
import Shop, { SubscriptionStatus } from '../models/Shop'; // Corrected import
import { logAudit } from '../utils/logger';

/**
 * @desc    Suspend Shop (Admin only)
 * @route   PUT /api/shops/:id/suspend
 * @access  Admin
 */
export const updateShopStatus = async (req: Request, res: Response) => {
  const { status, reason } = req.body;
  const { id } = req.params;

  try {
    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const oldStatus = shop.subscriptionStatus;
    shop.subscriptionStatus = status;
    if (reason) shop.suspensionReason = reason;
    await shop.save();

    await logAudit(req.user, 'UPDATE_SHOP_STATUS', 'Shop', shop._id, { oldStatus, newStatus: status, reason });

    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

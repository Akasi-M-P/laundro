const Shop = require('../models/Shop');
const { logAudit } = require('../utils/logger');

/**
 * @desc    Suspend Shop (Admin only)
 * @route   PUT /api/shops/:id/suspend
 * @access  Admin
 */
const updateShopStatus = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { updateShopStatus };

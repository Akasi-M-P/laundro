const Shop = require('../models/Shop');
const { logAudit } = require('../utils/logger');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Suspend Shop (Admin only)
 * @route   PUT /api/shops/:id/suspend
 * @access  Admin
 */
const updateShopStatus = asyncHandler(async (req, res, next) => {
  // Extract status and reason from request body
  const { status, reason } = req.body;
  // Get shop ID from URL parameters
  const { id } = req.params;

  // Find the shop by its ID in the database
  const shop = await Shop.findById(id);

  // If shop does not exist, return 404 Not Found
  if (!shop) {
    return next(new ErrorResponse('Shop not found', 404));
  }

  // Store the old status for audit logging purposes
  const oldStatus = shop.subscriptionStatus;
  
  // Update the shop's subscription status
  shop.subscriptionStatus = status;
  
  // If a reason is provided (e.g., for suspension), update it
  if (reason) shop.suspensionReason = reason;
  
  // Save the updated shop document to the database
  await shop.save();

  // Log this administrative action in the audit logs
  await logAudit(req.user, 'UPDATE_SHOP_STATUS', 'Shop', shop._id, { oldStatus, newStatus: status, reason });

  // Return the updated shop data with success status
  res.json({ success: true, data: shop });
});

module.exports = { updateShopStatus };

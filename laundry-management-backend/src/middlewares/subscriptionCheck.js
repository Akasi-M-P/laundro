const Shop = require('../models/Shop');
const { SubscriptionStatus } = Shop;
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

/**
 * Middleware to check if shop subscription is active
 * Blocks operations if shop is suspended
 */
const checkSubscription = asyncHandler(async (req, res, next) => {
  // Admin users bypass subscription check
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }

  // If user has shopId, check subscription status
  if (req.user && req.user.shopId) {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return next(new ErrorResponse('Shop not found', 404));
    }

    if (shop.subscriptionStatus === SubscriptionStatus.SUSPENDED) {
      return next(new ErrorResponse(
        'Shop is suspended. Cannot perform this operation. Please contact support.',
        403
      ));
    }

    // GRACE period: Allow read operations but block write operations
    if (shop.subscriptionStatus === SubscriptionStatus.GRACE) {
      // Allow GET requests (read operations)
      if (req.method === 'GET') {
        return next();
      }
      // Block write operations during grace period
      return next(new ErrorResponse(
        'Shop subscription is in grace period. Please renew your subscription to continue.',
        403
      ));
    }
  }

  next();
});

module.exports = { checkSubscription };

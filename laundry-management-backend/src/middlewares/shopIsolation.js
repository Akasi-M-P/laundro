const ErrorResponse = require('../utils/errorResponse');

/**
 * Middleware to ensure shop isolation
 * Verifies that the resource belongs to the user's shop
 * 
 * Usage: verifyShopAccess('orderId') - expects req.params.orderId
 *        verifyShopAccess('orderId', 'order') - expects req.params.orderId, checks order.shopId
 */
const verifyShopAccess = (paramName, modelName = null) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName] || req.body[paramName];
      
      if (!resourceId) {
        return next(new ErrorResponse(`${paramName} is required`, 400));
      }

      // If modelName provided, fetch and verify shopId
      if (modelName) {
        const Model = require(`../models/${modelName}`);
        const resource = await Model.findById(resourceId);
        
        if (!resource) {
          return next(new ErrorResponse(`${modelName} not found`, 404));
        }

        // Verify shopId matches
        const resourceShopId = resource.shopId ? resource.shopId.toString() : null;
        const userShopId = req.user.shopId ? req.user.shopId.toString() : null;

        if (resourceShopId !== userShopId) {
          return next(new ErrorResponse('Access denied: Resource does not belong to your shop', 403));
        }

        // Attach resource to request for use in controller
        req[modelName.toLowerCase()] = resource;
      }

      next();
    } catch (error) {
      next(new ErrorResponse('Error verifying shop access', 500));
    }
  };
};

/**
 * Middleware to verify shopId in request body matches user's shop
 * Useful for operations where shopId is passed in body
 */
const verifyShopId = (req, res, next) => {
  if (req.body.shopId && req.body.shopId.toString() !== req.user.shopId.toString()) {
    return next(new ErrorResponse('Access denied: Cannot access other shop resources', 403));
  }
  next();
};

module.exports = { verifyShopAccess, verifyShopId };

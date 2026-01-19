const express = require('express');
const { recordPayment, getPayments } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { checkSubscription } = require('../middlewares/subscriptionCheck');
const { createStrictRateLimiter } = require('../middlewares/rateLimiter');
const { UserRole } = require('../models/User');

const router = express.Router();

// Rate limiter for payment operations
const paymentLimiter = createStrictRateLimiter({
  max: 30, // 30 payments per 5 minutes per shop
  message: 'Too many payment requests. Please slow down.'
});

router.use(protect);
router.use(checkSubscription); // Check subscription status for all payment operations

/**
 * @swagger
 * /api/v1/payments:
 *   get:
 *     summary: Get all payments for a shop
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: Filter by order ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), getPayments);

router.post('/', [
    paymentLimiter,
    authorize(UserRole.OWNER, UserRole.EMPLOYEE),
    (req, res, next) => {
        const { check, validationResult } = require('express-validator');
        Promise.all([
            check('orderId', 'Order ID is required').not().isEmpty().run(req),
            check('amount', 'Amount must be a number').isNumeric().run(req)
        ]).then(() => {
             const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next({ name: 'ValidationError', message: errors.array()[0].msg, statusCode: 400 });
            }
            next();
        });
    }
], recordPayment);

module.exports = router;

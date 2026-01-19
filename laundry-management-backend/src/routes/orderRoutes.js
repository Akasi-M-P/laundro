const express = require('express');
const { createOrder, markReady, collectOrder, getOrders, getOrder } = require('../controllers/orderController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { checkSubscription } = require('../middlewares/subscriptionCheck');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect); // All routes require login
router.use(checkSubscription); // Check subscription status for all order operations

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get all orders for a shop
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CREATED, PROCESSING, READY, COLLECTED]
 *         description: Filter by order status
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of orders
 *       401:
 *         description: Unauthorized
 */
router.get('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), getOrders);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/:id', authorize(UserRole.OWNER, UserRole.EMPLOYEE), getOrder);

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - items
 *               - totalAmount
 *             properties:
 *               customerId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               totalAmount:
 *                 type: number
 *               amountPaid:
 *                 type: number
 *               offlineId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created
 */
// Create Order: Employee or Owner
router.post('/', [
    authorize(UserRole.OWNER, UserRole.EMPLOYEE),
    (req, res, next) => {
        const { check, validationResult } = require('express-validator');
        // Validation logic inline or extracted
        Promise.all([
            check('customerId', 'Customer ID is required').not().isEmpty().run(req),
            check('items', 'Items must be an array').isArray({ min: 1 }).run(req),
            check('totalAmount', 'Total amount must be a number').isNumeric().run(req)
        ]).then(() => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const message = errors.array().map(err => err.msg).join(', ');
                return next({ name: 'ValidationError', message, statusCode: 400 }); // Simplified error call
            }
            next();
        });
    }
], createOrder);

/**
 * @swagger
 * /api/v1/orders/{id}/ready:
 *   put:
 *     summary: Mark order as ready for pickup
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order marked as ready
 */
// Mark Ready: Employee or Owner
router.put('/:id/ready', authorize(UserRole.OWNER, UserRole.EMPLOYEE), markReady);

/**
 * @swagger
 * /api/v1/orders/{id}/collect:
 *   post:
 *     summary: Collect order (requires PIN)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order collected
 *       401:
 *         description: Invalid PIN
 */
// Collect: Employee or Owner
router.post('/:id/collect', [
    authorize(UserRole.OWNER, UserRole.EMPLOYEE),
    (req, res, next) => {
        const { check, validationResult } = require('express-validator');
        check('pin', 'PIN is required').not().isEmpty().run(req).then(() => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next({ name: 'ValidationError', message: errors.array()[0].msg, statusCode: 400 });
            }
            next();
        });
    }
], collectOrder);

module.exports = router;

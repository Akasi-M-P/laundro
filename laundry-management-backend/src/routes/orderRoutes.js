const express = require('express');
const { createOrder, markReady, collectOrder } = require('../controllers/orderController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { checkSubscription } = require('../middlewares/subscriptionCheck');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect); // All routes require login
router.use(checkSubscription); // Check subscription status for all order operations

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

// Mark Ready: Employee or Owner
router.put('/:id/ready', authorize(UserRole.OWNER, UserRole.EMPLOYEE), markReady);

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

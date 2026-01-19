const express = require('express');
const { recordPayment } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect);

router.post('/', [
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

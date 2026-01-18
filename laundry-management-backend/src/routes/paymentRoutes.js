const express = require('express');
const { recordPayment } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect);

router.post('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), recordPayment);

module.exports = router;

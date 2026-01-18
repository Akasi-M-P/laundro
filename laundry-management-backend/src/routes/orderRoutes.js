const express = require('express');
const { createOrder, markReady, collectOrder } = require('../controllers/orderController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect); // All routes require login

// Create Order: Employee or Owner
router.post('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), createOrder);

// Mark Ready: Employee or Owner
router.put('/:id/ready', authorize(UserRole.OWNER, UserRole.EMPLOYEE), markReady);

// Collect: Employee or Owner
router.post('/:id/collect', authorize(UserRole.OWNER, UserRole.EMPLOYEE), collectOrder);

module.exports = router;

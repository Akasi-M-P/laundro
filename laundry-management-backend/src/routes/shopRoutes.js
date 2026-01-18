const express = require('express');
const { updateShopStatus } = require('../controllers/shopController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { UserRole } = require('../models/User');

const router = express.Router();

router.use(protect);

// Admin only: Suspend/Reactivate
router.put('/:id/status', authorize(UserRole.ADMIN), updateShopStatus);

module.exports = router;

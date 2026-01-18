import express from 'express';
import { updateShopStatus } from '../controllers/shopController';
import { protect } from '../middlewares/auth';
import { authorize } from '../middlewares/rbac';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Admin only: Suspend/Reactivate
router.put('/:id/status', authorize(UserRole.ADMIN), updateShopStatus);

export default router;

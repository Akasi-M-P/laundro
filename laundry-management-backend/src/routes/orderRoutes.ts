import express from 'express';
import { createOrder, markReady, collectOrder } from '../controllers/orderController';
import { protect } from '../middlewares/auth';
import { authorize } from '../middlewares/rbac';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect); // All routes require login

// Create Order: Employee or Owner
router.post('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), createOrder);

// Mark Ready: Employee or Owner
router.put('/:id/ready', authorize(UserRole.OWNER, UserRole.EMPLOYEE), markReady);

// Collect: Employee or Owner
router.post('/:id/collect', authorize(UserRole.OWNER, UserRole.EMPLOYEE), collectOrder);

export default router;

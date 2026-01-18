import express from 'express';
import { recordPayment } from '../controllers/paymentController';
import { protect } from '../middlewares/auth';
import { authorize } from '../middlewares/rbac';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.post('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), recordPayment);

export default router;

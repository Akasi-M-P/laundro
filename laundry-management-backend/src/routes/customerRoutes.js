const express = require('express');
const { getCustomers, getCustomer, createCustomer, updateCustomer } = require('../controllers/customerController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { checkSubscription } = require('../middlewares/subscriptionCheck');
const { UserRole } = require('../models/User');
const { check, validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');

const router = express.Router();

// Validation Middleware Helper
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    const message = errors.array().map(err => err.msg).join(', ');
    next(new ErrorResponse(message, 400));
  };
};

router.use(protect);
router.use(checkSubscription);

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: Get all customers for a shop
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or phone number
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
 *         description: List of customers
 */
router.get('/', authorize(UserRole.OWNER, UserRole.EMPLOYEE), getCustomers);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
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
 *         description: Customer details
 *       404:
 *         description: Customer not found
 */
router.get('/:id', authorize(UserRole.OWNER, UserRole.EMPLOYEE), getCustomer);

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phoneNumber
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 */
router.post('/', 
  authorize(UserRole.OWNER, UserRole.EMPLOYEE),
  validate([
    check('name', 'Name is required').not().isEmpty(),
    check('phoneNumber', 'Phone number is required').not().isEmpty()
  ]),
  createCustomer
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated
 */
router.put('/:id', authorize(UserRole.OWNER, UserRole.EMPLOYEE), updateCustomer);

module.exports = router;

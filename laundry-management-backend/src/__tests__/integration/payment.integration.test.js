const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const Shop = require('../../models/Shop');
const User = require('../../models/User');
const Customer = require('../../models/Customer');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI?.replace(/\/\w+$/, '/test');

describe('Payment Integration Tests', () => {
  let shop;
  let owner;
  let customer;
  let order;
  let authToken;

  beforeAll(async () => {
    if (!TEST_MONGO_URI) {
      console.log('Skipping integration tests - TEST_MONGO_URI not configured');
      return;
    }

    // Create test data
    shop = await Shop.create({
      businessName: 'Test Laundry Shop',
      phone: '1234567890',
      location: 'Test Location',
      subscriptionStatus: 'ACTIVE'
    });

    owner = await User.create({
      shopId: shop._id,
      name: 'Test Owner',
      email: 'owner@test.com',
      passwordHash: 'hashedpassword',
      role: 'OWNER',
      isActive: true
    });

    customer = await Customer.create({
      shopId: shop._id,
      name: 'Test Customer',
      phoneNumber: '9876543210'
    });

    order = await Order.create({
      shopId: shop._id,
      customerId: customer._id,
      items: [{ itemName: 'Shirt', size: 'M', priceAtOrderTime: 100, quantity: 1 }],
      totalAmount: 100,
      amountPaid: 0,
      status: 'CREATED',
      createdBy: owner._id
    });

    authToken = jwt.sign(
      { id: owner._id, role: owner.role },
      process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-long-for-testing',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (TEST_MONGO_URI) {
      await Shop.deleteMany({});
      await User.deleteMany({});
      await Customer.deleteMany({});
      await Order.deleteMany({});
      await Payment.deleteMany({});
    }
  });

  describe('POST /api/v1/payments', () => {
    it('should record a payment successfully', async () => {
      if (!TEST_MONGO_URI) return;

      const paymentData = {
        orderId: order._id.toString(),
        amount: 50,
        method: 'CASH'
      };

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(50);

      // Verify order was updated
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.amountPaid).toBe(50);
      expect(updatedOrder.balance).toBe(50);
    });

    it('should reject payment exceeding order balance', async () => {
      if (!TEST_MONGO_URI) return;

      const paymentData = {
        orderId: order._id.toString(),
        amount: 200, // Exceeds total of 100
        method: 'CASH'
      };

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('exceeds');
    });

    it('should reject negative payment amount', async () => {
      if (!TEST_MONGO_URI) return;

      const paymentData = {
        orderId: order._id.toString(),
        amount: -50,
        method: 'CASH'
      };

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/payments', () => {
    it('should get list of payments', async () => {
      if (!TEST_MONGO_URI) return;

      // Create test payments
      await Payment.create([
        {
          orderId: order._id,
          amount: 30,
          method: 'CASH',
          receivedBy: owner._id
        },
        {
          orderId: order._id,
          amount: 20,
          method: 'ELECTRONIC',
          receivedBy: owner._id
        }
      ]);

      const res = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ orderId: order._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});

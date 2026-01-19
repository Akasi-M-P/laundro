const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const Shop = require('../../models/Shop');
const User = require('../../models/User');
const Customer = require('../../models/Customer');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');

// Skip if test database is not configured
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI?.replace(/\/\w+$/, '/test');

describe('Order Integration Tests', () => {
  let shop;
  let owner;
  let customer;
  let authToken;

  beforeAll(async () => {
    if (!TEST_MONGO_URI) {
      console.log('Skipping integration tests - TEST_MONGO_URI not configured');
      return;
    }

    // Create test shop
    shop = await Shop.create({
      businessName: 'Test Laundry Shop',
      phone: '1234567890',
      location: 'Test Location',
      subscriptionStatus: 'ACTIVE'
    });

    // Create test owner
    owner = await User.create({
      shopId: shop._id,
      name: 'Test Owner',
      email: 'owner@test.com',
      passwordHash: 'hashedpassword',
      role: 'OWNER',
      isActive: true
    });

    // Create test customer
    customer = await Customer.create({
      shopId: shop._id,
      name: 'Test Customer',
      phoneNumber: '9876543210'
    });

    // Generate auth token
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

  describe('POST /api/v1/orders', () => {
    it('should create a new order successfully', async () => {
      if (!TEST_MONGO_URI) {
        return; // Skip if test DB not configured
      }

      const orderData = {
        customerId: customer._id.toString(),
        items: [
          {
            itemName: 'Shirt',
            size: 'M',
            priceAtOrderTime: 50,
            quantity: 2
          }
        ],
        totalAmount: 100,
        amountPaid: 0
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('CREATED');
      expect(res.body.data.totalAmount).toBe(100);
    });

    it('should create order with initial payment', async () => {
      if (!TEST_MONGO_URI) return;

      const orderData = {
        customerId: customer._id.toString(),
        items: [
          {
            itemName: 'Trousers',
            size: 'L',
            priceAtOrderTime: 75,
            quantity: 1
          }
        ],
        totalAmount: 75,
        amountPaid: 50
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('PROCESSING');
      expect(res.body.data.amountPaid).toBe(50);

      // Verify payment was created
      const payments = await Payment.find({ orderId: res.body.data._id });
      expect(payments.length).toBe(1);
      expect(payments[0].amount).toBe(50);
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should get list of orders with pagination', async () => {
      if (!TEST_MONGO_URI) return;

      // Create some test orders
      await Order.create([
        {
          shopId: shop._id,
          customerId: customer._id,
          items: [{ itemName: 'Shirt', size: 'M', priceAtOrderTime: 50, quantity: 1 }],
          totalAmount: 50,
          amountPaid: 0,
          status: 'CREATED',
          createdBy: owner._id
        },
        {
          shopId: shop._id,
          customerId: customer._id,
          items: [{ itemName: 'Trousers', size: 'L', priceAtOrderTime: 75, quantity: 1 }],
          totalAmount: 75,
          amountPaid: 75,
          status: 'PROCESSING',
          createdBy: owner._id
        }
      ]);

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('total');
    });

    it('should filter orders by status', async () => {
      if (!TEST_MONGO_URI) return;

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'CREATED' });

      expect(res.statusCode).toBe(200);
      res.body.data.forEach(order => {
        expect(order.status).toBe('CREATED');
      });
    });
  });
});

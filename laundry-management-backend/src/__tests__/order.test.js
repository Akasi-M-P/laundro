const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('../routes/orderRoutes');
const { protect } = require('../middlewares/auth');

// Mock middleware
jest.mock('../middlewares/auth');
jest.mock('../middlewares/subscriptionCheck', () => ({
  checkSubscription: (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/v1/orders', orderRoutes);

describe('Order Routes', () => {
  let mockUser;
  let mockToken;

  beforeEach(() => {
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      shopId: new mongoose.Types.ObjectId(),
      role: 'OWNER',
      email: 'test@example.com'
    };

    mockToken = 'mock-token';
    
    // Mock protect middleware
    protect.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/orders', () => {
    it('should require authentication', async () => {
      protect.mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, message: 'Unauthorized' });
      });

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/orders', () => {
    it('should return 400 if customerId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          items: [{ itemName: 'Shirt', size: 'M', priceAtOrderTime: 50, quantity: 1 }],
          totalAmount: 50
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Customer ID');
    });

    it('should return 400 if items array is empty', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          customerId: new mongoose.Types.ObjectId().toString(),
          items: [],
          totalAmount: 50
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if totalAmount is not a number', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          customerId: new mongoose.Types.ObjectId().toString(),
          items: [{ itemName: 'Shirt', size: 'M', priceAtOrderTime: 50, quantity: 1 }],
          totalAmount: 'not-a-number'
        });

      expect(res.statusCode).toBe(400);
    });
  });
});

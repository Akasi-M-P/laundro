const request = require('supertest');
const express = require('express');
const paymentRoutes = require('../routes/paymentRoutes');
const { protect } = require('../middlewares/auth');

// Mock middleware
jest.mock('../middlewares/auth');
jest.mock('../middlewares/subscriptionCheck', () => ({
  checkSubscription: (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/v1/payments', paymentRoutes);

describe('Payment Routes', () => {
  let mockUser;
  let mockToken;

  beforeEach(() => {
    mockUser = {
      _id: 'user123',
      shopId: 'shop123',
      role: 'OWNER'
    };

    mockToken = 'mock-token';
    
    protect.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/payments', () => {
    it('should return 400 if orderId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 100
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if amount is not a number', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          orderId: 'order123',
          amount: 'not-a-number'
        });

      expect(res.statusCode).toBe(400);
    });
  });
});

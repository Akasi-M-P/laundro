const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/authRoutes');

// Mock app setup
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Auth Routes - Input Validation', () => {
  describe('POST /api/v1/auth/register-shop', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-shop')
        .send({});
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-shop')
        .send({
          businessName: 'Test Shop',
          phone: '1234567890',
          ownerName: 'John Doe',
          email: 'invalid-email',
          password: 'password123'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('valid email');
    });

    it('should return 400 if password is too short', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-shop')
        .send({
          businessName: 'Test Shop',
          phone: '1234567890',
          ownerName: 'John Doe',
          email: 'test@example.com',
          password: '123'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('6 or more characters');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 if email or password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });
      
      expect(res.statusCode).toBe(400);
    });
  });
});

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Laundro API',
      version: '1.0.0',
      description: 'API documentation for Laundro - Laundry Management System',
      contact: {
        name: 'API Support',
        email: 'support@laundro.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            shopId: { type: 'string' },
            customerId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['CREATED', 'PROCESSING', 'READY', 'COLLECTED']
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemName: { type: 'string' },
                  size: { type: 'string' },
                  priceAtOrderTime: { type: 'number' },
                  quantity: { type: 'number' },
                  photoUrl: { type: 'string' },
                  note: { type: 'string' }
                }
              }
            },
            totalAmount: { type: 'number' },
            amountPaid: { type: 'number' },
            balance: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderId: { type: 'string' },
            amount: { type: 'number' },
            method: {
              type: 'string',
              enum: ['CASH', 'ELECTRONIC']
            },
            receivedBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            shopId: { type: 'string' },
            name: { type: 'string' },
            phoneNumber: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Payments', description: 'Payment management endpoints' },
      { name: 'Customers', description: 'Customer management endpoints' },
      { name: 'Shops', description: 'Shop management endpoints' }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

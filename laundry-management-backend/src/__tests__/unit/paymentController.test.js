const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const paymentRoutes = require("../../routes/paymentRoutes");

// Mock dependencies
jest.mock("../../models/Payment");
jest.mock("../../models/Order");
jest.mock("../../utils/logger");
jest.mock("../../middlewares/auth");
jest.mock("../../middlewares/subscriptionCheck");

const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const { logAudit } = require("../../utils/logger");
const { protect } = require("../../middlewares/auth");

const app = express();
app.use(express.json());

// Mock middleware
protect.mockImplementation((req, res, next) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    shopId: new mongoose.Types.ObjectId(),
    role: "OWNER",
  };
  next();
});

app.use("/api/v1/payments", paymentRoutes);

describe("Payment Controller Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment
    process.env.NODE_ENV = "test";

    // Mock logger
    logAudit.mockResolvedValue();
  });

  describe("POST /api/v1/payments - Record Payment", () => {
    const validPaymentData = {
      orderId: new mongoose.Types.ObjectId().toString(),
      amount: 50,
      method: "CASH",
    };

    it("should record payment successfully", async () => {
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 150,
        amountPaid: 50,
        balance: 100,
        status: "PROCESSING",
      };

      const mockUpdatedOrder = {
        _id: validPaymentData.orderId,
        shopId: mockOrder.shopId,
        totalAmount: 150,
        amountPaid: 100,
        balance: 50,
        status: "PROCESSING",
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: validPaymentData.orderId,
        amount: 50,
        method: "CASH",
        receivedBy: new mongoose.Types.ObjectId(),
      };

      Order.findOne.mockResolvedValue(mockOrder);
      Order.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder);
      Payment.findOne.mockResolvedValue(null); // No existing payment
      Payment.create.mockResolvedValue(mockPayment);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(validPaymentData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(50);
      expect(res.body.data.method).toBe("CASH");
      expect(Order.findOneAndUpdate).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject payment without authentication", async () => {
      // Mock protect to return 401
      protect.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ success: false, message: "Unauthorized" });
      });

      const res = await request(app)
        .post("/api/v1/payments")
        .send(validPaymentData);

      expect(res.status).toBe(401);
    });

    it("should reject payment with negative amount", async () => {
      const invalidPaymentData = {
        ...validPaymentData,
        amount: -10,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(invalidPaymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("positive number");
    });

    it("should reject payment with zero amount", async () => {
      const invalidPaymentData = {
        ...validPaymentData,
        amount: 0,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(invalidPaymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("positive number");
    });

    it("should reject payment for non-existent order", async () => {
      Order.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(validPaymentData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should reject payment for order from different shop", async () => {
      const differentShopId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: differentShopId,
        totalAmount: 150,
        amountPaid: 50,
        balance: 100,
        status: "PROCESSING",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(validPaymentData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should reject payment that exceeds balance", async () => {
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 100,
        amountPaid: 50,
        balance: 50,
        status: "PROCESSING",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const excessivePaymentData = {
        ...validPaymentData,
        amount: 75, // Exceeds balance of 50
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(excessivePaymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("exceeds remaining balance");
    });

    it("should reject payment for collected order", async () => {
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 150,
        amountPaid: 150,
        balance: 0,
        status: "COLLECTED",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(validPaymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot pay for collected order");
    });

    it("should handle race condition and retry", async () => {
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 150,
        amountPaid: 50,
        balance: 100,
        status: "PROCESSING",
      };

      // First call to Order.findOneAndUpdate fails (race condition)
      Order.findOne.mockResolvedValue(mockOrder);
      Order.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({
        _id: validPaymentData.orderId,
        shopId: mockOrder.shopId,
        totalAmount: 150,
        amountPaid: 100,
        balance: 50,
        status: "PROCESSING",
      });

      // Second call to Order.findById for recheck
      Order.findById = jest.fn().mockResolvedValue({
        _id: validPaymentData.orderId,
        totalAmount: 150,
        amountPaid: 75, // Someone else paid 25
        balance: 75,
        status: "PROCESSING",
      });

      Payment.findOne.mockResolvedValue(null);
      Payment.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        orderId: validPaymentData.orderId,
        amount: 25, // Adjusted amount
        method: "CASH",
      });

      const adjustedPaymentData = {
        ...validPaymentData,
        amount: 25, // Adjust amount for race condition
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(adjustedPaymentData);

      expect(res.status).toBe(400); // Should fail due to race condition
      expect(res.body.message).toContain("Payment could not be processed");
    });

    it("should handle idempotent payments with offlineId", async () => {
      const offlineId = "test-payment-offline-123";
      const paymentDataWithOfflineId = {
        ...validPaymentData,
        offlineId,
      };

      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 150,
        amountPaid: 50,
        balance: 100,
        status: "PROCESSING",
      };

      const existingPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: validPaymentData.orderId,
        offlineId,
        amount: 50,
        method: "CASH",
      };

      Order.findOne.mockResolvedValue(mockOrder);
      Payment.findOne.mockResolvedValue(existingPayment);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(paymentDataWithOfflineId);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Payment already synced");
    });

    it("should accept different payment methods", async () => {
      const mockOrder = {
        _id: validPaymentData.orderId,
        shopId: new mongoose.Types.ObjectId(),
        totalAmount: 150,
        amountPaid: 50,
        balance: 100,
        status: "PROCESSING",
      };

      const mockUpdatedOrder = {
        _id: validPaymentData.orderId,
        shopId: mockOrder.shopId,
        totalAmount: 150,
        amountPaid: 100,
        balance: 50,
        status: "PROCESSING",
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: validPaymentData.orderId,
        amount: 50,
        method: "ELECTRONIC",
        receivedBy: new mongoose.Types.ObjectId(),
      };

      Order.findOne.mockResolvedValue(mockOrder);
      Order.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder);
      Payment.findOne.mockResolvedValue(null);
      Payment.create.mockResolvedValue(mockPayment);

      const electronicPaymentData = {
        ...validPaymentData,
        method: "ELECTRONIC",
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", "Bearer token")
        .send(electronicPaymentData);

      expect(res.status).toBe(201);
      expect(res.body.data.method).toBe("ELECTRONIC");
    });
  });

  describe("GET /api/v1/payments - List Payments", () => {
    it("should list payments with pagination", async () => {
      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: new mongoose.Types.ObjectId(),
          amount: 50,
          method: "CASH",
          receivedBy: { name: "Owner", email: "owner@test.com" },
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: new mongoose.Types.ObjectId(),
          amount: 25,
          method: "ELECTRONIC",
          receivedBy: { name: "Employee", email: "employee@test.com" },
          createdAt: new Date(),
        },
      ];

      Payment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockPayments),
              }),
            }),
          }),
        }),
      });
      Payment.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/v1/payments?page=1&limit=10")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    it("should filter payments by orderId", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
      };

      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          amount: 50,
          method: "CASH",
          receivedBy: { name: "Owner" },
        },
      ];

      Order.findOne.mockResolvedValue(mockOrder);
      Payment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockPayments),
              }),
            }),
          }),
        }),
      });
      Payment.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get(`/api/v1/payments?orderId=${orderId}`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].orderId).toBe(orderId.toString());
    });

    it("should reject access to payments for order from different shop", async () => {
      const orderId = new mongoose.Types.ObjectId();
      Order.findOne.mockResolvedValue(null); // Order not found in user's shop

      const res = await request(app)
        .get(`/api/v1/payments?orderId=${orderId}`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should sort payments by createdAt desc by default", async () => {
      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: new mongoose.Types.ObjectId(),
          amount: 50,
          method: "CASH",
          receivedBy: { name: "Owner" },
          createdAt: new Date("2024-01-02"),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: new mongoose.Types.ObjectId(),
          amount: 25,
          method: "ELECTRONIC",
          receivedBy: { name: "Employee" },
          createdAt: new Date("2024-01-01"),
        },
      ];

      Payment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockPayments),
              }),
            }),
          }),
        }),
      });
      Payment.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/v1/payments")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(Payment.find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          sort: { createdAt: -1 },
        }),
      );
    });

    it("should support custom sorting", async () => {
      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: new mongoose.Types.ObjectId(),
          amount: 25,
          method: "CASH",
          receivedBy: { name: "Owner" },
          createdAt: new Date(),
        },
      ];

      Payment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockPayments),
              }),
            }),
          }),
        }),
      });
      Payment.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/v1/payments?sortBy=amount&sortOrder=asc")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(Payment.find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          sort: { amount: 1 },
        }),
      );
    });
  });
});

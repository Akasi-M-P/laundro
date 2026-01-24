const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const orderRoutes = require("../../routes/orderRoutes");

// Mock dependencies
jest.mock("../../models/Order");
jest.mock("../../models/Customer");
jest.mock("../../models/Shop");
jest.mock("../../models/Payment");
jest.mock("../../services/smsService");
jest.mock("../../utils/logger");
jest.mock("../../utils/pin");
jest.mock("../../middlewares/auth");
jest.mock("../../middlewares/subscriptionCheck");

const Order = require("../../models/Order");
const Customer = require("../../models/Customer");
const Shop = require("../../models/Shop");
const Payment = require("../../models/Payment");
const smsService = require("../../services/smsService");
const { logAudit } = require("../../utils/logger");
const { generatePin, hashPin, verifyPin } = require("../../utils/pin");
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

app.use("/api/v1/orders", orderRoutes);

describe("Order Controller Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment
    process.env.NODE_ENV = "test";

    // Mock services
    smsService.sendPickupPIN = jest.fn().mockResolvedValue(true);
    logAudit.mockResolvedValue();

    // Mock PIN utilities
    generatePin.mockReturnValue("123456");
    hashPin.mockResolvedValue("hashed-pin");
    verifyPin.mockResolvedValue(true);
  });

  describe("POST /api/v1/orders - Create Order", () => {
    const validOrderData = {
      customerId: new mongoose.Types.ObjectId().toString(),
      items: [
        {
          itemName: "Shirt",
          size: "M",
          priceAtOrderTime: 50,
          quantity: 2,
        },
      ],
      totalAmount: 100,
      amountPaid: 50,
    };

    it("should create order successfully", async () => {
      const mockCustomer = {
        _id: validOrderData.customerId,
        shopId: new mongoose.Types.ObjectId(),
      };

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        ...validOrderData,
        shopId: mockCustomer.shopId,
        status: "PROCESSING",
        createdBy: new mongoose.Types.ObjectId(),
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.create.mockResolvedValue([mockOrder]);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(validOrderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PROCESSING");
      expect(res.body.data.amountPaid).toBe(50);
    });

    it("should create order with payment in transaction", async () => {
      const mockCustomer = {
        _id: validOrderData.customerId,
        shopId: new mongoose.Types.ObjectId(),
      };

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        ...validOrderData,
        shopId: mockCustomer.shopId,
        status: "PROCESSING",
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: mockOrder._id,
        amount: 50,
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.create.mockResolvedValue([mockOrder]);
      Payment.create.mockResolvedValue([mockPayment]);

      // Mock mongoose transaction
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(validOrderData);

      expect(res.status).toBe(201);
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(Payment.create).toHaveBeenCalled();
    });

    it("should reject order creation for invalid customer", async () => {
      Customer.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(validOrderData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Customer not found");
    });

    it("should reject order creation for customer from different shop", async () => {
      const differentShopId = new mongoose.Types.ObjectId();
      const mockCustomer = {
        _id: validOrderData.customerId,
        shopId: differentShopId,
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(validOrderData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Customer not found");
    });

    it("should handle transaction rollback on error", async () => {
      const mockCustomer = {
        _id: validOrderData.customerId,
        shopId: new mongoose.Types.ObjectId(),
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.create.mockRejectedValue(new Error("Database error"));

      // Mock mongoose transaction
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(validOrderData);

      expect(res.status).toBe(500);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it("should handle idempotent order creation with offlineId", async () => {
      const offlineId = "test-offline-123";
      const orderDataWithOfflineId = {
        ...validOrderData,
        offlineId,
      };

      const mockCustomer = {
        _id: validOrderData.customerId,
        shopId: new mongoose.Types.ObjectId(),
      };

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        ...orderDataWithOfflineId,
        shopId: mockCustomer.shopId,
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockResolvedValue(existingOrder);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", "Bearer token")
        .send(orderDataWithOfflineId);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Order already synced");
    });
  });

  describe("PUT /api/v1/orders/:id/ready - Mark Order Ready", () => {
    it("should mark order as ready and generate PIN", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "PROCESSING",
        save: jest.fn().mockResolvedValue(this),
      };

      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(),
        phoneNumber: "+1234567890",
      };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue(mockCustomer);

      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/ready`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(generatePin).toHaveBeenCalled();
      expect(hashPin).toHaveBeenCalledWith("123456");
      expect(mockOrder.save).toHaveBeenCalled();
      expect(smsService.sendPickupPIN).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should handle SMS failure gracefully", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "PROCESSING",
        save: jest.fn().mockResolvedValue(this),
      };

      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(),
        phoneNumber: "+1234567890",
      };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue(mockCustomer);
      smsService.sendPickupPIN.mockRejectedValue(new Error("SMS failed"));

      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/ready`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200); // Should still succeed
      expect(res.body.success).toBe(true);
    });

    it("should reject marking non-existent order as ready", async () => {
      const orderId = new mongoose.Types.ObjectId();

      Order.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/ready`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should reject marking order from different shop as ready", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const differentShopId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        shopId: differentShopId,
        status: "PROCESSING",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/ready`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should reject marking collected order as ready", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "COLLECTED",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/ready`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Order must be Processing or Created");
    });
  });

  describe("POST /api/v1/orders/:id/collect - Collect Order", () => {
    it("should collect order with valid PIN", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "READY",
        balance: 0,
        pickupPinHash: "hashed-pin",
        collectedBy: undefined,
        collectedAt: undefined,
        save: jest.fn().mockResolvedValue(this),
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/collect`)
        .set("Authorization", "Bearer token")
        .send({ pin: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("COLLECTED");
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockOrder.pickupPinHash).toBeUndefined();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject collection with invalid PIN", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "READY",
        balance: 0,
        pickupPinHash: "hashed-pin",
      };

      Order.findOne.mockResolvedValue(mockOrder);
      verifyPin.mockResolvedValue(false);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/collect`)
        .set("Authorization", "Bearer token")
        .send({ pin: "wrong-pin" });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid Pickup PIN");
      expect(logAudit).toHaveBeenCalledWith(
        expect.any(Object),
        "FAILED_COLLECTION_ATTEMPT",
        "Order",
        orderId,
        { reason: "Invalid PIN" },
      );
    });

    it("should reject collection if balance not paid", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "READY",
        balance: 50,
        pickupPinHash: "hashed-pin",
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/collect`)
        .set("Authorization", "Bearer token")
        .send({ pin: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("outstanding balance");
    });

    it("should reject collection of non-ready order", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "PROCESSING",
        balance: 0,
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/collect`)
        .set("Authorization", "Bearer token")
        .send({ pin: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("not ready for pickup");
    });
  });

  describe("GET /api/v1/orders - List Orders", () => {
    it("should list orders with pagination", async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          shopId: new mongoose.Types.ObjectId(),
          status: "PROCESSING",
          customerId: { name: "Customer 1", phoneNumber: "+1234567890" },
          createdBy: { name: "Owner", email: "owner@test.com" },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          shopId: new mongoose.Types.ObjectId(),
          status: "READY",
          customerId: { name: "Customer 2", phoneNumber: "+0987654321" },
          createdBy: { name: "Owner", email: "owner@test.com" },
        },
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockOrders),
              }),
            }),
          }),
        }),
      });
      Order.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/v1/orders?page=1&limit=10")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it("should filter orders by status", async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          shopId: new mongoose.Types.ObjectId(),
          status: "READY",
          customerId: { name: "Customer 1" },
          createdBy: { name: "Owner" },
        },
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockOrders),
              }),
            }),
          }),
        }),
      });
      Order.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/v1/orders?status=READY")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(Order.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: "READY" }),
      );
    });
  });

  describe("GET /api/v1/orders/:id - Get Single Order", () => {
    it("should get single order with payments", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        shopId: new mongoose.Types.ObjectId(),
        status: "PROCESSING",
        customerId: { name: "Customer", phoneNumber: "+1234567890" },
        createdBy: { name: "Owner", email: "owner@test.com" },
        toObject: jest.fn().mockReturnValue({
          _id: orderId,
          status: "PROCESSING",
          customerId: { name: "Customer" },
          createdBy: { name: "Owner" },
        }),
      };

      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          amount: 50,
          method: "CASH",
          receivedBy: { name: "Owner", email: "owner@test.com" },
        },
      ];

      Order.findOne.mockResolvedValue(mockOrder);
      Payment.find.mockResolvedValue(mockPayments);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(orderId.toString());
      expect(res.body.data.payments).toHaveLength(1);
    });

    it("should reject access to order from different shop", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const differentShopId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        shopId: differentShopId,
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });
  });
});

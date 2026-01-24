const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const User = require("../../models/User");
const Shop = require("../../models/Shop");
const Customer = require("../../models/Customer");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const { UserRole } = User;
const { SubscriptionStatus } = Shop;
const { OrderStatus } = Order;
const { PaymentMethod } = Payment;

describe("Order Lifecycle Integration Tests", () => {
  let shop, owner, employee, customer, authToken, employeeToken;

  beforeAll(async () => {
    // Create test shop
    shop = await Shop.create({
      businessName: "Test Laundry Shop",
      phone: "+1234567890",
      location: "Test Location",
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    // Create owner user
    owner = await User.create({
      shopId: shop._id,
      name: "Test Owner",
      email: "owner@test.com",
      passwordHash: "hashedpassword",
      role: UserRole.OWNER,
      isActive: true,
    });

    // Create employee user
    employee = await User.create({
      shopId: shop._id,
      name: "Test Employee",
      email: "employee@test.com",
      passwordHash: "hashedpassword",
      role: UserRole.EMPLOYEE,
      isActive: true,
    });

    // Create customer
    customer = await Customer.create({
      shopId: shop._id,
      name: "Test Customer",
      phoneNumber: "+0987654321",
    });

    // Generate auth tokens
    authToken = jwt.sign(
      { id: owner._id, role: owner.role },
      process.env.JWT_SECRET ||
        "test-secret-key-minimum-32-characters-long-for-testing",
    );

    employeeToken = jwt.sign(
      { id: employee._id, role: employee.role },
      process.env.JWT_SECRET ||
        "test-secret-key-minimum-32-characters-long-for-testing",
    );
  });

  describe("POST /api/v1/orders - Create Order", () => {
    it("should create a new order successfully", async () => {
      const orderData = {
        customerId: customer._id.toString(),
        items: [
          {
            itemName: "Shirt",
            size: "M",
            priceAtOrderTime: 50,
            quantity: 2,
            note: "Wash and iron",
          },
          {
            itemName: "Pants",
            size: "L",
            priceAtOrderTime: 80,
            quantity: 1,
          },
        ],
        totalAmount: 180,
        amountPaid: 100,
      };

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("_id");
      expect(res.body.data.status).toBe(OrderStatus.PROCESSING);
      expect(res.body.data.amountPaid).toBe(100);
      expect(res.body.data.balance).toBe(80);
      expect(res.body.data.shopId).toBe(shop._id.toString());
      expect(res.body.data.customerId).toBe(customer._id.toString());
    });

    it("should reject order creation without authentication", async () => {
      const orderData = {
        customerId: customer._id.toString(),
        items: [
          { itemName: "Shirt", size: "M", priceAtOrderTime: 50, quantity: 1 },
        ],
        totalAmount: 50,
      };

      const res = await request(app).post("/api/v1/orders").send(orderData);

      expect(res.status).toBe(401);
    });

    it("should reject order creation with invalid customer", async () => {
      const orderData = {
        customerId: new mongoose.Types.ObjectId().toString(),
        items: [
          { itemName: "Shirt", size: "M", priceAtOrderTime: 50, quantity: 1 },
        ],
        totalAmount: 50,
      };

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Customer not found");
    });

    it("should handle idempotent order creation with offlineId", async () => {
      const offlineId = "test-offline-id-123";
      const orderData = {
        customerId: customer._id.toString(),
        items: [
          { itemName: "Dress", size: "S", priceAtOrderTime: 100, quantity: 1 },
        ],
        totalAmount: 100,
        offlineId,
      };

      // Create first time
      const res1 = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      expect(res1.status).toBe(201);

      // Try to create again with same offlineId
      const res2 = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain("Order already synced");
    });
  });

  describe("GET /api/v1/orders - List Orders", () => {
    it("should list orders for the shop", async () => {
      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Check that all orders belong to the shop
      res.body.data.forEach((order) => {
        expect(
          order.shopId || order.shopId?._id || order.shopId?.toString(),
        ).toBe(shop._id.toString());
      });
    });

    it("should filter orders by status", async () => {
      const res = await request(app)
        .get("/api/v1/orders?status=PROCESSING")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((order) => {
        expect(order.status).toBe(OrderStatus.PROCESSING);
      });
    });

    it("should paginate results", async () => {
      const res = await request(app)
        .get("/api/v1/orders?page=1&limit=2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  describe("PUT /api/v1/orders/:id/ready - Mark Order Ready", () => {
    let processingOrder;

    beforeAll(async () => {
      // Create a processing order
      processingOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          { itemName: "Jacket", size: "L", priceAtOrderTime: 150, quantity: 1 },
        ],
        totalAmount: 150,
        amountPaid: 150,
        status: OrderStatus.PROCESSING,
        createdBy: owner._id,
      });
    });

    it("should mark order as ready and generate PIN", async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${processingOrder._id}/ready`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(OrderStatus.READY);

      // Verify PIN was generated (should be hashed in DB, not returned)
      const updatedOrder = await Order.findById(processingOrder._id);
      expect(updatedOrder.pickupPinHash).toBeDefined();
      expect(updatedOrder.status).toBe(OrderStatus.READY);
    });

    it("should reject marking collected order as ready", async () => {
      // First mark as ready
      await Order.findByIdAndUpdate(processingOrder._id, {
        status: OrderStatus.READY,
      });

      const res = await request(app)
        .put(`/api/v1/orders/${processingOrder._id}/ready`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Order must be Processing or Created");
    });
  });

  describe("POST /api/v1/orders/:id/collect - Collect Order", () => {
    let readyOrder, pin;

    beforeAll(async () => {
      // Create a ready order with PIN
      const { generatePin, hashPin } = require("../../utils/pin");
      pin = generatePin();
      const pinHash = await hashPin(pin);

      readyOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          { itemName: "Suit", size: "M", priceAtOrderTime: 200, quantity: 1 },
        ],
        totalAmount: 200,
        amountPaid: 200,
        balance: 0,
        status: OrderStatus.READY,
        pickupPinHash: pinHash,
        createdBy: owner._id,
      });
    });

    it("should collect order with valid PIN", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${readyOrder._id}/collect`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ pin });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(OrderStatus.COLLECTED);
      expect(res.body.data.collectedBy).toBe(owner._id.toString());

      // Verify PIN is invalidated
      const updatedOrder = await Order.findById(readyOrder._id);
      expect(updatedOrder.pickupPinHash).toBeUndefined();
    });

    it("should reject collection with invalid PIN", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${readyOrder._id}/collect`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ pin: "wrong-pin" });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid Pickup PIN");
    });

    it("should reject collection if balance not paid", async () => {
      const unpaidOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          { itemName: "Shoes", size: "42", priceAtOrderTime: 100, quantity: 1 },
        ],
        totalAmount: 100,
        amountPaid: 50,
        balance: 50,
        status: OrderStatus.READY,
        createdBy: owner._id,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${unpaidOrder._id}/collect`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ pin: "123456" }); // Wrong PIN anyway

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("outstanding balance");
    });
  });

  describe("GET /api/v1/orders/:id - Get Single Order", () => {
    let testOrder;

    beforeAll(async () => {
      testOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          {
            itemName: "Hat",
            size: "One Size",
            priceAtOrderTime: 25,
            quantity: 1,
          },
        ],
        totalAmount: 25,
        amountPaid: 25,
        status: OrderStatus.COLLECTED,
        createdBy: owner._id,
      });
    });

    it("should get single order with details", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${testOrder._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testOrder._id.toString());
      expect(res.body.data.customerId.name).toBe(customer.name);
      expect(res.body.data.createdBy.name).toBe(owner.name);
    });

    it("should reject access to order from different shop", async () => {
      // Create another shop and order
      const otherShop = await Shop.create({
        businessName: "Other Shop",
        phone: "+1111111111",
        location: "Other Location",
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });

      const otherOrder = await Order.create({
        shopId: otherShop._id,
        customerId: customer._id, // Wrong shop for customer, but testing shop isolation
        items: [
          {
            itemName: "Other Item",
            size: "M",
            priceAtOrderTime: 10,
            quantity: 1,
          },
        ],
        totalAmount: 10,
        createdBy: owner._id,
      });

      const res = await request(app)
        .get(`/api/v1/orders/${otherOrder._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});

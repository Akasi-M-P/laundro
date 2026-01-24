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

describe("Payment Integration Tests", () => {
  let shop, owner, customer, authToken, testOrder;

  beforeAll(async () => {
    // Create test shop
    shop = await Shop.create({
      businessName: "Test Payment Shop",
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

    // Create customer
    customer = await Customer.create({
      shopId: shop._id,
      name: "Test Customer",
      phoneNumber: "+0987654321",
    });

    // Create test order
    testOrder = await Order.create({
      shopId: shop._id,
      customerId: customer._id,
      items: [
        { itemName: "Shirt", size: "M", priceAtOrderTime: 50, quantity: 1 },
        { itemName: "Pants", size: "L", priceAtOrderTime: 100, quantity: 1 },
      ],
      totalAmount: 150,
      amountPaid: 50,
      balance: 100,
      status: OrderStatus.PROCESSING,
      createdBy: owner._id,
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: owner._id, role: owner.role },
      process.env.JWT_SECRET ||
        "test-secret-key-minimum-32-characters-long-for-testing",
    );
  });

  describe("POST /api/v1/payments - Record Payment", () => {
    it("should record a payment successfully", async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: 50,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(50);
      expect(res.body.data.method).toBe(PaymentMethod.CASH);
      expect(res.body.data.receivedBy.toString()).toBe(owner._id.toString());

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.amountPaid).toBe(100);
      expect(updatedOrder.balance).toBe(50);
      expect(updatedOrder.status).toBe(OrderStatus.PROCESSING);
    });

    it("should reject payment without authentication", async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: 25,
        method: PaymentMethod.CASH,
      };

      const res = await request(app).post("/api/v1/payments").send(paymentData);

      expect(res.status).toBe(401);
    });

    it("should reject payment with negative amount", async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: -10,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("positive number");
    });

    it("should reject payment with zero amount", async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: 0,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("positive number");
    });

    it("should reject payment that exceeds balance", async () => {
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: 100, // Current balance is 50
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("exceeds remaining balance");
    });

    it("should reject payment for non-existent order", async () => {
      const paymentData = {
        orderId: new mongoose.Types.ObjectId().toString(),
        amount: 25,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should reject payment for order from different shop", async () => {
      // Create another shop and order
      const otherShop = await Shop.create({
        businessName: "Other Shop",
        phone: "+1111111111",
        location: "Other Location",
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });

      const otherOrder = await Order.create({
        shopId: otherShop._id,
        customerId: customer._id,
        items: [
          {
            itemName: "Other Item",
            size: "M",
            priceAtOrderTime: 50,
            quantity: 1,
          },
        ],
        totalAmount: 50,
        createdBy: owner._id,
      });

      const paymentData = {
        orderId: otherOrder._id.toString(),
        amount: 25,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order not found");
    });

    it("should handle idempotent payments with offlineId", async () => {
      const offlineId = "test-payment-offline-123";
      const paymentData = {
        orderId: testOrder._id.toString(),
        amount: 25,
        method: PaymentMethod.CASH,
        offlineId,
      };

      // Record first payment
      const res1 = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res1.status).toBe(201);

      // Try to record the same payment again
      const res2 = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain("Payment already synced");
    });

    it("should reject payment for collected order", async () => {
      // Create a collected order
      const collectedOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          {
            itemName: "Collected Item",
            size: "M",
            priceAtOrderTime: 75,
            quantity: 1,
          },
        ],
        totalAmount: 75,
        amountPaid: 75,
        status: OrderStatus.COLLECTED,
        createdBy: owner._id,
      });

      const paymentData = {
        orderId: collectedOrder._id.toString(),
        amount: 25,
        method: PaymentMethod.CASH,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot pay for collected order");
    });

    it("should accept different payment methods", async () => {
      // Create order with remaining balance
      const methodTestOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          {
            itemName: "Method Test",
            size: "L",
            priceAtOrderTime: 200,
            quantity: 1,
          },
        ],
        totalAmount: 200,
        amountPaid: 100,
        status: OrderStatus.PROCESSING,
        createdBy: owner._id,
      });

      const paymentData = {
        orderId: methodTestOrder._id.toString(),
        amount: 50,
        method: PaymentMethod.ELECTRONIC,
      };

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .send(paymentData);

      expect(res.status).toBe(201);
      expect(res.body.data.method).toBe(PaymentMethod.ELECTRONIC);
    });
  });

  describe("GET /api/v1/payments - List Payments", () => {
    it("should list payments for shop orders", async () => {
      const res = await request(app)
        .get("/api/v1/payments")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it("should filter payments by orderId", async () => {
      const res = await request(app)
        .get(`/api/v1/payments?orderId=${testOrder._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((payment) => {
        expect(payment.orderId.toString()).toBe(testOrder._id.toString());
      });
    });

    it("should paginate payment results", async () => {
      const res = await request(app)
        .get("/api/v1/payments?page=1&limit=2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    it("should sort payments by createdAt desc by default", async () => {
      const res = await request(app)
        .get("/api/v1/payments?limit=5")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 1) {
        for (let i = 0; i < res.body.data.length - 1; i++) {
          const currentDate = new Date(res.body.data[i].createdAt);
          const nextDate = new Date(res.body.data[i + 1].createdAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(
            nextDate.getTime(),
          );
        }
      }
    });
  });

  describe("Race Condition Tests", () => {
    it("should handle concurrent payments without race conditions", async () => {
      // Create order with balance
      const raceOrder = await Order.create({
        shopId: shop._id,
        customerId: customer._id,
        items: [
          {
            itemName: "Race Test",
            size: "M",
            priceAtOrderTime: 100,
            quantity: 1,
          },
        ],
        totalAmount: 100,
        amountPaid: 0,
        status: OrderStatus.CREATED,
        createdBy: owner._id,
      });

      // Attempt concurrent payments
      const paymentPromises = [];
      for (let i = 0; i < 3; i++) {
        const paymentData = {
          orderId: raceOrder._id.toString(),
          amount: 25,
          method: PaymentMethod.CASH,
        };

        paymentPromises.push(
          request(app)
            .post("/api/v1/payments")
            .set("Authorization", `Bearer ${authToken}`)
            .send(paymentData),
        );
      }

      const results = await Promise.allSettled(paymentPromises);

      // Count successes and failures
      const successes = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === 201,
      ).length;
      const failures = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === 400,
      ).length;

      // Should have exactly one success (first payment) and two failures (race condition handled)
      expect(successes + failures).toBe(3);

      // Verify final state
      const finalOrder = await Order.findById(raceOrder._id);
      expect(finalOrder.amountPaid).toBe(25); // Only one payment should succeed
      expect(finalOrder.balance).toBe(75);

      // Verify payment records
      const payments = await Payment.find({ orderId: raceOrder._id });
      expect(payments.length).toBe(1);
      expect(payments[0].amount).toBe(25);
    });
  });
});

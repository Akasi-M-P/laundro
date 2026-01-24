const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("../../routes/authRoutes");

// Mock dependencies
jest.mock("../../models/User");
jest.mock("../../models/Shop");
jest.mock("../../models/Otp");
jest.mock("../../services/smsService");
jest.mock("../../utils/logger");
jest.mock("../../utils/otp");

const User = require("../../models/User");
const Shop = require("../../models/Shop");
const Otp = require("../../models/Otp");
const smsService = require("../../services/smsService");
const { logger, logAudit } = require("../../utils/logger");
const { generateOtp } = require("../../utils/otp");

const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

describe("Auth Controller Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment
    process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";
    process.env.JWT_EXPIRE = "1d";
    process.env.NODE_ENV = "test";

    // Mock logger
    logger.error = jest.fn();
    logAudit.mockResolvedValue();

    // Mock SMS service
    smsService.sendOTP = jest.fn().mockResolvedValue(true);
    smsService.sendPickupPIN = jest.fn().mockResolvedValue(true);
  });

  describe("POST /api/v1/auth/register-shop", () => {
    const validRegistrationData = {
      businessName: "Test Laundry",
      phone: "+1234567890",
      location: "Test Location",
      ownerName: "John Doe",
      email: "owner@test.com",
      password: "password123",
    };

    it("should register shop successfully", async () => {
      // Mock Shop.create
      const mockShop = {
        _id: new mongoose.Types.ObjectId(),
        ...validRegistrationData,
        subscriptionStatus: "ACTIVE",
      };
      Shop.create.mockResolvedValue(mockShop);

      // Mock User.create
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        shopId: mockShop._id,
        name: validRegistrationData.ownerName,
        email: validRegistrationData.email,
        passwordHash: "hashedpassword",
        role: "OWNER",
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(this),
      };
      User.create.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/register-shop")
        .send(validRegistrationData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shop.businessName).toBe(
        validRegistrationData.businessName,
      );
      expect(res.body.data.user.name).toBe(validRegistrationData.ownerName);
      expect(res.body.data).toHaveProperty("token");
    });

    it("should return 400 for missing required fields", async () => {
      const invalidData = {
        businessName: "Test Laundry",
        // missing phone, location, ownerName, email, password
      };

      const res = await request(app)
        .post("/api/v1/auth/register-shop")
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("required");
    });

    it("should return 400 for invalid email format", async () => {
      const invalidData = {
        ...validRegistrationData,
        email: "invalid-email",
      };

      const res = await request(app)
        .post("/api/v1/auth/register-shop")
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("valid email");
    });

    it("should return 400 for password too short", async () => {
      const invalidData = {
        ...validRegistrationData,
        password: "123",
      };

      const res = await request(app)
        .post("/api/v1/auth/register-shop")
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("6 or more characters");
    });

    it("should handle database errors gracefully", async () => {
      Shop.create.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .post("/api/v1/auth/register-shop")
        .send(validRegistrationData);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    const validLoginData = {
      email: "owner@test.com",
      password: "password123",
    };

    it("should login successfully", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: validLoginData.email,
        role: "OWNER",
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(this),
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(validLoginData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should return 401 for invalid credentials", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(validLoginData);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid credentials");
    });

    it("should return 401 for incorrect password", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: validLoginData.email,
        matchPassword: jest.fn().mockResolvedValue(false),
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(validLoginData);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid credentials");
    });

    it("should return 401 for deactivated user", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: validLoginData.email,
        isActive: false,
        matchPassword: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(validLoginData);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("User is deactivated");
    });

    it("should return 400 for missing email or password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@test.com" }); // missing password

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/otp-request", () => {
    const otpRequestData = {
      phoneNumber: "+1234567890",
    };

    it("should request OTP successfully for employee", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpRequestData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      Otp.findOne.mockResolvedValue(null); // No recent OTP
      generateOtp.mockReturnValue("123456");
      Otp.create.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/auth/otp-request")
        .send(otpRequestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("OTP sent");
      expect(generateOtp).toHaveBeenCalled();
      expect(Otp.create).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should not reveal if user exists", async () => {
      User.findOne.mockResolvedValue(null); // User doesn't exist

      const res = await request(app)
        .post("/api/v1/auth/otp-request")
        .send(otpRequestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("If the employee exists");
      expect(generateOtp).not.toHaveBeenCalled();
    });

    it("should reject request within rate limit window", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpRequestData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      Otp.findOne.mockResolvedValue({ createdAt: new Date() }); // Recent OTP exists

      const res = await request(app)
        .post("/api/v1/auth/otp-request")
        .send(otpRequestData);

      expect(res.status).toBe(429);
      expect(res.body.message).toContain("Please wait before requesting");
    });

    it("should handle SMS sending failure gracefully", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpRequestData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      Otp.findOne.mockResolvedValue(null);
      generateOtp.mockReturnValue("123456");
      smsService.sendOTP.mockRejectedValue(new Error("SMS failed"));
      Otp.create.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/auth/otp-request")
        .send(otpRequestData);

      expect(res.status).toBe(200); // Should still succeed
      expect(logger.error).toHaveBeenCalled();
    });

    it("should reject non-employee users", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpRequestData.phoneNumber,
        role: "OWNER", // Not employee
        isActive: true,
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/otp-request")
        .send(otpRequestData);

      expect(res.status).toBe(200);
      expect(generateOtp).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/otp-verify", () => {
    const otpVerifyData = {
      phoneNumber: "+1234567890",
      otp: "123456",
    };

    it("should verify OTP and login successfully", async () => {
      const mockOtp = {
        _id: new mongoose.Types.ObjectId(),
        phoneNumber: otpVerifyData.phoneNumber,
        otp: otpVerifyData.otp,
      };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpVerifyData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
        save: jest.fn().mockResolvedValue(this),
      };

      Otp.findOne.mockResolvedValue(mockOtp);
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/otp-verify")
        .send(otpVerifyData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(mockUser.save).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should return 401 for invalid OTP", async () => {
      Otp.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/otp-verify")
        .send(otpVerifyData);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid or expired OTP");
    });

    it("should return 401 for deactivated user", async () => {
      const mockOtp = {
        _id: new mongoose.Types.ObjectId(),
        phoneNumber: otpVerifyData.phoneNumber,
        otp: otpVerifyData.otp,
      };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpVerifyData.phoneNumber,
        role: "EMPLOYEE",
        isActive: false,
      };

      Otp.findOne.mockResolvedValue(mockOtp);
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/otp-verify")
        .send(otpVerifyData);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("User is deactivated");
    });

    it("should delete used OTP", async () => {
      const mockOtp = {
        _id: new mongoose.Types.ObjectId(),
        phoneNumber: otpVerifyData.phoneNumber,
        otp: otpVerifyData.otp,
      };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpVerifyData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
        save: jest.fn().mockResolvedValue(this),
      };

      Otp.findOne.mockResolvedValue(mockOtp);
      User.findOne.mockResolvedValue(mockUser);
      Otp.deleteOne = jest.fn().mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/auth/otp-verify")
        .send(otpVerifyData);

      expect(res.status).toBe(200);
      expect(Otp.deleteOne).toHaveBeenCalledWith({ _id: mockOtp._id });
    });

    it("should log failed verification attempts", async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: otpVerifyData.phoneNumber,
        role: "EMPLOYEE",
        isActive: true,
      };

      Otp.findOne.mockResolvedValue(null);
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/otp-verify")
        .send(otpVerifyData);

      expect(res.status).toBe(401);
      expect(logAudit).toHaveBeenCalledWith(
        mockUser,
        "OTP_VERIFICATION_FAILED",
        "User",
        mockUser._id,
        { phoneNumber: otpVerifyData.phoneNumber },
      );
    });
  });
});

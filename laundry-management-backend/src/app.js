const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const shopRoutes = require("./routes/shopRoutes");
const customerRoutes = require("./routes/customerRoutes");

const app = express();

// Request ID middleware (should be first)
const requestId = require("./middlewares/requestId");
app.use(requestId);

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // In production, check against allowed origins
    if (process.env.NODE_ENV === "production") {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [];

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.length === 0
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Request size limits and parsing
const bodyParser = require("body-parser");

// Enhanced body parsing with proper size limits
app.use(
  express.json({
    limit: process.env.REQUEST_SIZE_LIMIT || "1mb", // Default 1MB for JSON
    strict: true, // Only accept arrays and objects
    verify: (req, res, buf) => {
      // Store raw body for webhook verification if needed
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_SIZE_LIMIT || "1mb", // Default 1MB for URL-encoded
  }),
);

// Raw body parser for specific routes (like webhooks) that need raw data
app.use(
  bodyParser.raw({
    type: "application/octet-stream",
    limit: process.env.FILE_UPLOAD_LIMIT || "10mb", // Separate limit for file uploads
  }),
);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Enable security middleware
app.use(mongoSanitize({ replaceWith: "_" })); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks

// Enhanced Rate Limiting
const {
  createUserRateLimiter,
  createStrictRateLimiter,
  createOTPRateLimiter,
} = require("./middlewares/rateLimiter");

// Global IP-based rate limiting (fallback)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.GLOBAL_RATE_LIMIT) || 1000, // requests per window
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
    retryAfter: 900, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiting to all routes
app.use(globalLimiter);

// User/shop-based rate limiting for authenticated routes
const userLimiter = createUserRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.USER_RATE_LIMIT) || 500, // requests per user/shop
  message: "Too many requests from your account, please try again later",
});

// Apply user-based rate limiting to authenticated routes only
app.use("/api/v1", userLimiter);

// Strict rate limiting for sensitive operations
const strictLimiter = createStrictRateLimiter();

// OTP rate limiting
const otpLimiter = createOTPRateLimiter();

// Http Logger
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Swagger Documentation
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_SWAGGER === "true"
) {
  const swaggerUi = require("swagger-ui-express");
  const swaggerSpec = require("./config/swagger");

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Laundro API Documentation",
    }),
  );
}

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/shops", shopRoutes);

// Health Check
app.get("/", async (req, res) => {
  const mongoose = require("mongoose");
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    services: {
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    },
  };

  // If database is not connected, return 503
  if (health.services.database !== "connected") {
    health.status = "degraded";
    return res.status(503).json(health);
  }

  res.status(200).json(health);
});

// Detailed health check endpoint
app.get("/health", async (req, res) => {
  const mongoose = require("mongoose");
  const { cacheService } = require("./config/cache");

  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const cacheHealth = await cacheService.healthCheck();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
    },
    services: {
      database: {
        status: dbStatus,
        host: mongoose.connection.host || "unknown",
        name: mongoose.connection.name || "unknown",
      },
      cache: cacheHealth,
    },
  };

  // Check if all services are healthy
  const dbHealthy = health.services.database.status === "connected";
  const cacheHealthy =
    health.services.cache.status === "healthy" ||
    health.services.cache.status === "disconnected"; // Cache is optional
  const allHealthy = dbHealthy;

  health.status = allHealthy ? "ok" : "degraded";

  res.status(allHealthy ? 200 : 503).json(health);
});

// Error Handler (must be last)
const errorHandler = require("./middlewares/error");
app.use(errorHandler);

module.exports = app;

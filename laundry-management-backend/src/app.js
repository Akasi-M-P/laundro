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

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Add body size limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security Middleware
app.use(helmet()); // Set security headers
// app.use(
//   mongoSanitize({
//     replaceWith: "_",
//   }),
// ); // Prevent NoSQL injection
// app.use(xss()); // Prevent XSS attacks

// Rate Limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 10 minutes",
});
app.use(limiter);

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
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
    services: {
      database: {
        status:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        host: mongoose.connection.host || "unknown",
        name: mongoose.connection.name || "unknown",
      },
    },
  };

  // Check if all services are healthy
  const allHealthy = health.services.database.status === "connected";
  health.status = allHealthy ? "ok" : "degraded";

  res.status(allHealthy ? 200 : 503).json(health);
});

// Error Handler (must be last)
const errorHandler = require("./middlewares/error");
app.use(errorHandler);

module.exports = app;

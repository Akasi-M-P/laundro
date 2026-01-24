const dotenv = require("dotenv");
const { connectDB } = require("./config/db");
const app = require("./app");

// Load env vars
dotenv.config({ path: "./config.env" });

// Validate required environment variables
const { validateEnv } = require("./config/validateEnv");
validateEnv();

// Connect to database
connectDB();

// Initialize cache service
const { cacheService } = require("./config/cache");
cacheService.connect().catch((error) => {
  const { logger } = require("./utils/logger");
  logger.error("Failed to initialize cache service:", error);
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  const { logger } = require("./utils/logger");
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  const { logger } = require("./utils/logger");
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info("HTTP server closed");

    // Close database connection
    const mongoose = require("mongoose");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  const { logger } = require("./utils/logger");
  logger.error("Unhandled Promise Rejection:", err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  const { logger } = require("./utils/logger");
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

// Graceful shutdown on SIGTERM and SIGINT
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

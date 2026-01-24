const { logger } = require("../utils/logger");

/**
 * Middleware to collect performance metrics for requests
 * Tracks response times, status codes, and request patterns
 */
const performanceMetrics = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  // Add metrics collection to response
  res.locals.metrics = {
    startTime,
    startMemory,
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    userId: req.user?.id,
    shopId: req.user?.shopId,
  };

  // Override res.end to capture metrics when response finishes
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
    };

    // Collect final metrics
    const metrics = {
      ...res.locals.metrics,
      statusCode: res.statusCode,
      durationMs,
      contentLength: res.get("Content-Length") || (chunk ? chunk.length : 0),
      memoryDelta,
      timestamp: new Date().toISOString(),
    };

    // Log performance metrics
    logPerformanceMetrics(metrics);

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Log performance metrics with appropriate level based on performance
 */
const logPerformanceMetrics = (metrics) => {
  const {
    method,
    url,
    statusCode,
    durationMs,
    memoryDelta,
    userId,
    shopId,
    requestId,
  } = metrics;

  // Determine log level based on performance and status
  let logLevel = "info";
  let message = `${method} ${url} - ${statusCode} (${durationMs.toFixed(2)}ms)`;

  // Flag slow requests (>1000ms)
  if (durationMs > 1000) {
    logLevel = "warn";
    message += " [SLOW]";
  }

  // Flag very slow requests (>5000ms)
  if (durationMs > 5000) {
    logLevel = "error";
    message += " [VERY SLOW]";
  }

  // Flag error responses
  if (statusCode >= 400) {
    logLevel = "warn";
    if (statusCode >= 500) {
      logLevel = "error";
    }
  }

  // Flag high memory usage (>10MB increase)
  if (Math.abs(memoryDelta.heapUsed) > 10 * 1024 * 1024) {
    message += ` [MEM: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB]`;
  }

  // Create structured log entry
  const logData = {
    requestId,
    method,
    url,
    statusCode,
    durationMs,
    memoryDelta: {
      heapUsed: Math.round((memoryDelta.heapUsed / 1024 / 1024) * 100) / 100, // MB with 2 decimals
      external: Math.round((memoryDelta.external / 1024 / 1024) * 100) / 100,
    },
    userId,
    shopId,
    timestamp: metrics.timestamp,
  };

  // Log with appropriate level
  logger.log(logLevel, message, logData);
};

/**
 * Middleware to track API usage patterns
 * Can be used for analytics and capacity planning
 */
const usageTracker = (req, res, next) => {
  // Track endpoint usage (simple in-memory counter for demo)
  // In production, this would be persisted to a time-series database
  if (!global.apiUsage) {
    global.apiUsage = new Map();
  }

  const key = `${req.method} ${req.route?.path || req.path}`;
  const current = global.apiUsage.get(key) || 0;
  global.apiUsage.set(key, current + 1);

  // Add usage info to response for monitoring
  res.locals.usage = {
    endpoint: key,
    totalRequests: current + 1,
  };

  next();
};

/**
 * Get current API usage statistics
 * Exposed via /metrics endpoint
 */
const getApiUsageStats = () => {
  if (!global.apiUsage) {
    return {};
  }

  const stats = {};
  let totalRequests = 0;

  for (const [endpoint, count] of global.apiUsage.entries()) {
    stats[endpoint] = count;
    totalRequests += count;
  }

  return {
    totalRequests,
    endpoints: stats,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Reset API usage counters (useful for testing or manual resets)
 */
const resetApiUsageStats = () => {
  if (global.apiUsage) {
    global.apiUsage.clear();
  }
  logger.info("API usage statistics reset");
};

module.exports = {
  performanceMetrics,
  usageTracker,
  getApiUsageStats,
  resetApiUsageStats,
};

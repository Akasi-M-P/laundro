const express = require("express");
const os = require("os");
const { cacheService } = require("../config/cache");
const { getApiUsageStats } = require("../middlewares/performanceMetrics");
const { logger } = require("../utils/logger");

const router = express.Router();

/**
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 * Returns application metrics in a format that can be scraped by monitoring systems
 */
router.get("/", async (req, res) => {
  try {
    const metrics = await collectMetrics();
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(metrics);
  } catch (error) {
    logger.error("Error collecting metrics:", error);
    res.status(500).send("Error collecting metrics");
  }
});

/**
 * GET /metrics/json
 * JSON format metrics endpoint for easier consumption
 */
router.get("/json", async (req, res) => {
  try {
    const metrics = await collectDetailedMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error("Error collecting detailed metrics:", error);
    res.status(500).json({ error: "Error collecting metrics" });
  }
});

/**
 * POST /metrics/reset
 * Reset usage counters (admin endpoint)
 */
router.post("/reset", (req, res) => {
  // This would typically require admin authentication
  const { resetApiUsageStats } = require("../middlewares/performanceMetrics");
  resetApiUsageStats();
  res.json({ message: "Metrics reset successfully" });
});

/**
 * Collect Prometheus-compatible metrics
 */
async function collectMetrics() {
  const lines = [];
  const timestamp = Date.now();

  // Application info
  lines.push(`# HELP laundro_info Application information`);
  lines.push(`# TYPE laundro_info gauge`);
  lines.push(
    `laundro_info{version="${process.env.npm_package_version || "1.0.0"}",node_version="${process.version}",environment="${process.env.NODE_ENV || "development"}"} 1 ${timestamp}`,
  );

  // Process metrics
  lines.push(`# HELP laundro_process_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE laundro_process_uptime_seconds gauge`);
  lines.push(`laundro_process_uptime_seconds ${process.uptime()} ${timestamp}`);

  lines.push(
    `# HELP laundro_process_memory_usage_bytes Process memory usage in bytes`,
  );
  lines.push(`# TYPE laundro_process_memory_usage_bytes gauge`);
  const memUsage = process.memoryUsage();
  lines.push(
    `laundro_process_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed} ${timestamp}`,
  );
  lines.push(
    `laundro_process_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal} ${timestamp}`,
  );
  lines.push(
    `laundro_process_memory_usage_bytes{type="external"} ${memUsage.external} ${timestamp}`,
  );
  lines.push(
    `laundro_process_memory_usage_bytes{type="rss"} ${memUsage.rss} ${timestamp}`,
  );

  // System metrics
  lines.push(`# HELP laundro_system_memory_bytes System memory in bytes`);
  lines.push(`# TYPE laundro_system_memory_bytes gauge`);
  lines.push(
    `laundro_system_memory_bytes{type="total"} ${os.totalmem()} ${timestamp}`,
  );
  lines.push(
    `laundro_system_memory_bytes{type="free"} ${os.freemem()} ${timestamp}`,
  );

  lines.push(`# HELP laundro_system_cpu_count Number of CPU cores`);
  lines.push(`# TYPE laundro_system_cpu_count gauge`);
  lines.push(`laundro_system_cpu_count ${os.cpus().length} ${timestamp}`);

  lines.push(`# HELP laundro_system_load_average System load average`);
  lines.push(`# TYPE laundro_system_load_average gauge`);
  const loadAvg = os.loadavg();
  lines.push(
    `laundro_system_load_average{period="1m"} ${loadAvg[0]} ${timestamp}`,
  );
  lines.push(
    `laundro_system_load_average{period="5m"} ${loadAvg[1]} ${timestamp}`,
  );
  lines.push(
    `laundro_system_load_average{period="15m"} ${loadAvg[2]} ${timestamp}`,
  );

  // Cache metrics (if available)
  if (cacheService.isConnected) {
    try {
      const cacheStats = await cacheService.getStats();
      if (cacheStats.status === "connected") {
        lines.push(`# HELP laundro_cache_keys_total Number of keys in cache`);
        lines.push(`# TYPE laundro_cache_keys_total gauge`);
        lines.push(
          `laundro_cache_keys_total ${cacheStats.dbSize || 0} ${timestamp}`,
        );

        lines.push(`# HELP laundro_cache_connected Cache connection status`);
        lines.push(`# TYPE laundro_cache_connected gauge`);
        lines.push(`laundro_cache_connected 1 ${timestamp}`);
      } else {
        lines.push(`# HELP laundro_cache_connected Cache connection status`);
        lines.push(`# TYPE laundro_cache_connected gauge`);
        lines.push(`laundro_cache_connected 0 ${timestamp}`);
      }
    } catch (error) {
      lines.push(`# HELP laundro_cache_connected Cache connection status`);
      lines.push(`# TYPE laundro_cache_connected gauge`);
      lines.push(`laundro_cache_connected 0 ${timestamp}`);
    }
  }

  // API usage metrics
  const usageStats = getApiUsageStats();
  if (usageStats.totalRequests > 0) {
    lines.push(
      `# HELP laundro_api_requests_total Total number of API requests`,
    );
    lines.push(`# TYPE laundro_api_requests_total counter`);

    for (const [endpoint, count] of Object.entries(
      usageStats.endpoints || {},
    )) {
      // Sanitize endpoint name for Prometheus (replace special chars)
      const sanitizedEndpoint = endpoint.replace(/[^a-zA-Z0-9_:]/g, "_");
      lines.push(
        `laundro_api_requests_total{endpoint="${sanitizedEndpoint}"} ${count} ${timestamp}`,
      );
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Collect detailed metrics in JSON format
 */
async function collectDetailedMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    application: {
      name: "laundro",
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      uptime: process.uptime(),
    },
    process: {
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
      loadAverage: os.loadavg(),
    },
    services: {},
    api: getApiUsageStats(),
  };

  // Add cache service status
  try {
    metrics.services.cache = await cacheService.healthCheck();
    if (metrics.services.cache.status === "healthy") {
      metrics.services.cache.stats = await cacheService.getStats();
    }
  } catch (error) {
    metrics.services.cache = { status: "error", error: error.message };
  }

  // Database connection status (simplified)
  const mongoose = require("mongoose");
  metrics.services.database = {
    status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    name: mongoose.connection.name,
    host: mongoose.connection.host,
    readyState: mongoose.connection.readyState,
  };

  return metrics;
}

module.exports = router;

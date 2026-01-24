const { logger } = require("./logger");

/**
 * Alerting system for monitoring application health and performance
 * Provides configurable thresholds and alert triggers
 */
class AlertManager {
  constructor() {
    this.alerts = new Map();
    this.alertHistory = [];
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the alerting system
   * @param {Object} config - Alerting configuration
   */
  start(config = {}) {
    if (this.isRunning) {
      logger.warn("Alerting system is already running");
      return;
    }

    const defaultConfig = {
      checkInterval: 60000, // 1 minute
      maxHistorySize: 1000,
      thresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.05, // 5% error rate
        memoryUsage: 0.8, // 80% memory usage
        cpuUsage: 0.9, // 90% CPU usage
        dbConnections: 0.9, // 90% of max connections
      },
      ...config,
    };

    this.config = defaultConfig;
    this.isRunning = true;

    logger.info("Starting alerting system", {
      checkInterval: this.config.checkInterval,
      thresholds: this.config.thresholds,
    });

    // Start periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    // Perform initial health check
    setTimeout(() => this.performHealthChecks(), 5000);
  }

  /**
   * Stop the alerting system
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info("Alerting system stopped");
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    try {
      const healthData = await this.collectHealthData();

      // Check various health metrics
      this.checkResponseTime(healthData);
      this.checkErrorRate(healthData);
      this.checkMemoryUsage(healthData);
      this.checkCpuUsage(healthData);
      this.checkDatabaseConnections(healthData);
      this.checkExternalServices(healthData);

      // Clean up old alerts
      this.cleanupOldAlerts();
    } catch (error) {
      logger.error("Error during health checks:", error);
      this.triggerAlert("HEALTH_CHECK_FAILED", "error", {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Collect health data from various sources
   */
  async collectHealthData() {
    const data = {
      timestamp: new Date(),
      responseTime: await this.getAverageResponseTime(),
      errorRate: await this.getErrorRate(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage(),
      database: await this.getDatabaseStatus(),
      cache: await this.getCacheStatus(),
    };

    return data;
  }

  /**
   * Check response time against threshold
   */
  checkResponseTime(healthData) {
    const { responseTime } = healthData;
    const threshold = this.config.thresholds.responseTime;

    if (responseTime.avg > threshold) {
      this.triggerAlert("HIGH_RESPONSE_TIME", "warning", {
        averageResponseTime: responseTime.avg,
        threshold,
        sampleSize: responseTime.count,
      });
    }
  }

  /**
   * Check error rate against threshold
   */
  checkErrorRate(healthData) {
    const { errorRate } = healthData;
    const threshold = this.config.thresholds.errorRate;

    if (errorRate.rate > threshold) {
      this.triggerAlert("HIGH_ERROR_RATE", "error", {
        errorRate: errorRate.rate,
        errorCount: errorRate.errors,
        totalRequests: errorRate.total,
        threshold,
      });
    }
  }

  /**
   * Check memory usage against threshold
   */
  checkMemoryUsage(healthData) {
    const { memoryUsage } = healthData;
    const threshold = this.config.thresholds.memoryUsage;

    if (memoryUsage.heapUsedRatio > threshold) {
      this.triggerAlert("HIGH_MEMORY_USAGE", "warning", {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usageRatio: memoryUsage.heapUsedRatio,
        threshold,
      });
    }
  }

  /**
   * Check CPU usage against threshold
   */
  checkCpuUsage(healthData) {
    const { cpuUsage } = healthData;
    const threshold = this.config.thresholds.cpuUsage;

    if (cpuUsage > threshold) {
      this.triggerAlert("HIGH_CPU_USAGE", "warning", {
        cpuUsage,
        threshold,
      });
    }
  }

  /**
   * Check database connection health
   */
  checkDatabaseConnections(healthData) {
    const { database } = healthData;

    if (database.status !== "connected") {
      this.triggerAlert("DATABASE_DISCONNECTED", "error", {
        status: database.status,
        host: database.host,
        readyState: database.readyState,
      });
    }

    // Check connection pool usage if available
    if (database.pool && database.pool.size > 0) {
      const usageRatio = database.pool.used / database.pool.size;
      const threshold = this.config.thresholds.dbConnections;

      if (usageRatio > threshold) {
        this.triggerAlert("HIGH_DB_CONNECTION_USAGE", "warning", {
          used: database.pool.used,
          total: database.pool.size,
          usageRatio,
          threshold,
        });
      }
    }
  }

  /**
   * Check external service health
   */
  checkExternalServices(healthData) {
    const { cache } = healthData;

    if (cache.status !== "healthy" && cache.status !== "disconnected") {
      this.triggerAlert("CACHE_SERVICE_UNHEALTHY", "warning", {
        status: cache.status,
        error: cache.error,
      });
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(type, severity, data) {
    const alert = {
      id: this.generateAlertId(),
      type,
      severity,
      data,
      timestamp: new Date(),
      resolved: false,
    };

    // Check if similar alert already exists and is unresolved
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) => a.type === type && !a.resolved,
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.data = data;
      existingAlert.timestamp = alert.timestamp;
      existingAlert.count = (existingAlert.count || 1) + 1;

      logger.log(this.getLogLevel(severity), `Alert updated: ${type}`, {
        alertId: existingAlert.id,
        count: existingAlert.count,
        data,
      });
    } else {
      // Create new alert
      this.alerts.set(alert.id, alert);
      this.alertHistory.push(alert);

      logger.log(this.getLogLevel(severity), `Alert triggered: ${type}`, {
        alertId: alert.id,
        data,
      });

      // Send alert notification (would integrate with external systems)
      this.sendAlertNotification(alert);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      logger.info(`Alert resolved: ${alert.type}`, {
        alertId,
        duration: alert.resolvedAt - alert.timestamp,
      });
    }
  }

  /**
   * Send alert notification (integrate with external systems)
   */
  sendAlertNotification(alert) {
    // In production, this would integrate with:
    // - Slack/Discord webhooks
    // - Email notifications
    // - SMS alerts
    // - PagerDuty/OpsGenie
    // - DataDog/New Relic alerts

    const notification = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: this.formatAlertMessage(alert),
      timestamp: alert.timestamp,
      data: alert.data,
    };

    // Log notification (in production, send to external service)
    logger.log(
      this.getLogLevel(alert.severity),
      `Alert notification: ${alert.type}`,
      notification,
    );

    // Example: Send to webhook (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.sendWebhookNotification(notification);
    }
  }

  /**
   * Format alert message for notifications
   */
  formatAlertMessage(alert) {
    const { type, data } = alert;

    switch (type) {
      case "HIGH_RESPONSE_TIME":
        return `High response time: ${data.averageResponseTime}ms (threshold: ${data.threshold}ms)`;
      case "HIGH_ERROR_RATE":
        return `High error rate: ${(data.errorRate * 100).toFixed(1)}% (${data.errorCount}/${data.totalRequests})`;
      case "HIGH_MEMORY_USAGE":
        return `High memory usage: ${(data.usageRatio * 100).toFixed(1)}%`;
      case "HIGH_CPU_USAGE":
        return `High CPU usage: ${(data.cpuUsage * 100).toFixed(1)}%`;
      case "DATABASE_DISCONNECTED":
        return `Database disconnected: ${data.status}`;
      case "CACHE_SERVICE_UNHEALTHY":
        return `Cache service unhealthy: ${data.status}`;
      default:
        return `Alert: ${type}`;
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(notification) {
    try {
      const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        logger.error("Failed to send alert webhook:", response.statusText);
      }
    } catch (error) {
      logger.error("Error sending alert webhook:", error.message);
    }
  }

  /**
   * Get log level for severity
   */
  getLogLevel(severity) {
    switch (severity) {
      case "error":
        return "error";
      case "warning":
        return "warn";
      default:
        return "info";
    }
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old alerts from history
   */
  cleanupOldAlerts() {
    // Keep only recent alerts
    if (this.alertHistory.length > this.config.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.config.maxHistorySize);
    }

    // Remove resolved alerts older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt < oneDayAgo) {
        this.alerts.delete(id);
      }
    }
  }

  // Health data collection methods (simplified implementations)

  async getAverageResponseTime() {
    // In a real implementation, this would track recent response times
    return { avg: 150, count: 100 }; // Mock data
  }

  async getErrorRate() {
    // In a real implementation, this would calculate error rate from recent requests
    return { rate: 0.02, errors: 2, total: 100 }; // Mock data
  }

  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedRatio: memUsage.heapUsed / memUsage.heapTotal,
    };
  }

  getCpuUsage() {
    // Simplified CPU usage calculation
    const cpuUsage = process.cpuUsage();
    const total = cpuUsage.user + cpuUsage.system;
    return total / 1000000; // Convert to seconds
  }

  async getDatabaseStatus() {
    const mongoose = require("mongoose");
    return {
      status:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    };
  }

  async getCacheStatus() {
    const { cacheService } = require("../config/cache");
    return await cacheService.healthCheck();
  }

  /**
   * Get current alerts
   */
  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }
}

// Create singleton instance
const alertManager = new AlertManager();

module.exports = { AlertManager, alertManager };

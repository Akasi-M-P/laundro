const Redis = require("ioredis");
const { logger } = require("../utils/logger");

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Redis connection configuration
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Only connect if Redis is enabled (default to false for development)
      if (process.env.REDIS_ENABLED !== "true") {
        logger.info(
          "🔄 Redis caching disabled (set REDIS_ENABLED=true to enable)",
        );
        return;
      }

      this.client = new Redis(redisConfig);

      // Event handlers
      this.client.on("connect", () => {
        this.isConnected = true;
        logger.info("✅ Redis connected successfully");
      });

      this.client.on("ready", () => {
        logger.info("🚀 Redis client ready");
      });

      this.client.on("error", (error) => {
        this.isConnected = false;
        logger.error("❌ Redis connection error:", error.message);
      });

      this.client.on("close", () => {
        this.isConnected = false;
        logger.warn("⚠️  Redis connection closed");
      });

      // Test connection
      await this.client.ping();
      logger.info("🏓 Redis ping successful");
    } catch (error) {
      logger.error("❌ Failed to connect to Redis:", error.message);
      this.isConnected = false;
      // Don't throw error - cache should be optional
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("🔌 Redis connection closed");
    }
  }

  // Generic cache operations
  async get(key) {
    if (!this.isConnected || !this.client) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`❌ Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    if (!this.isConnected || !this.client) return false;

    try {
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      logger.error(`❌ Redis SET error for key ${key}:`, error.message);
      return false;
    }
  }

  async delete(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`❌ Redis DELETE error for key ${key}:`, error.message);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`❌ Redis EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  // Shop-specific cache operations
  getShopKey(shopId) {
    return `shop:${shopId}`;
  }

  getUserKey(userId) {
    return `user:${userId}`;
  }

  async getShop(shopId) {
    const key = this.getShopKey(shopId);
    return await this.get(key);
  }

  async setShop(shopId, shopData, ttlSeconds = 3600) {
    // 1 hour default
    const key = this.getShopKey(shopId);
    return await this.set(key, shopData, ttlSeconds);
  }

  async invalidateShop(shopId) {
    const key = this.getShopKey(shopId);
    return await this.delete(key);
  }

  async getUser(userId) {
    const key = this.getUserKey(userId);
    return await this.get(key);
  }

  async setUser(userId, userData, ttlSeconds = 1800) {
    // 30 minutes default
    const key = this.getUserKey(userId);
    return await this.set(key, userData, ttlSeconds);
  }

  async invalidateUser(userId) {
    const key = this.getUserKey(userId);
    return await this.delete(key);
  }

  // Cache statistics (for monitoring)
  async getStats() {
    if (!this.isConnected || !this.client) {
      return { status: "disconnected" };
    }

    try {
      const info = await this.client.info();
      const dbSize = await this.client.dbsize();

      return {
        status: "connected",
        dbSize,
        info: info.split("\r\n").reduce((acc, line) => {
          if (line.includes(":")) {
            const [key, value] = line.split(":");
            acc[key] = value;
          }
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error("❌ Redis stats error:", error.message);
      return { status: "error", error: error.message };
    }
  }

  // Health check
  async healthCheck() {
    if (!this.isConnected || !this.client) {
      return { status: "disconnected" };
    }

    try {
      await this.client.ping();
      return { status: "healthy" };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = { CacheService, cacheService };

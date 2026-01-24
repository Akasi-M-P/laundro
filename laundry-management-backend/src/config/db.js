const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    // Database connection options for production readiness
    const options = {
      // Connection pooling
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10, // Maximum number of connections in the connection pool
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5, // Minimum number of connections in the connection pool
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000, // How long a connection can be idle before being closed
      serverSelectionTimeoutMS: 5000, // How long to wait for server selection
      socketTimeoutMS: 45000, // How long to wait for socket operations
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering

      // Retry and reconnection
      retryWrites: true,
      retryReads: true,

      // Authentication and security
      authSource: "admin",
      tls: process.env.NODE_ENV === "production",
      tlsCAFile: process.env.DB_TLS_CA_FILE,
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    // Connection event handlers
    mongoose.connection.on("connected", () => {
      console.log(
        `✅ MongoDB connected successfully to ${conn.connection.host}`,
      );
      console.log(
        `📊 Connection pool size: min=${options.minPoolSize}, max=${options.maxPoolSize}`,
      );
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔄 MongoDB connection closed due to app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };

/**
 * Validates required environment variables on startup
 * Fails fast if critical configuration is missing
 */

const validateEnv = () => {
  const required = ['MONGO_URI', 'JWT_SECRET'];
  const missing = [];

  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these in your config.env file or environment variables.');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long for security.');
    console.error('   Current length:', process.env.JWT_SECRET.length);
    process.exit(1);
  }

  // Validate MONGO_URI format (basic check)
  if (!process.env.MONGO_URI.startsWith('mongodb://') && !process.env.MONGO_URI.startsWith('mongodb+srv://')) {
    console.error('❌ MONGO_URI must be a valid MongoDB connection string.');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
};

module.exports = { validateEnv };

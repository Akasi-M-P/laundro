const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: './config.env' });

// Test database connection
const connectTestDB = async () => {
  const testMongoURI = process.env.TEST_MONGO_URI || process.env.MONGO_URI?.replace(/\/\w+$/, '/test');
  
  if (!testMongoURI) {
    throw new Error('TEST_MONGO_URI or MONGO_URI must be set for integration tests');
  }

  try {
    await mongoose.connect(testMongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Test database connected');
  } catch (error) {
    console.error('Test database connection error:', error);
    throw error;
  }
};

// Clean up test database
const cleanupTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error('Error cleaning test database:', error);
  }
};

// Close test database connection
const closeTestDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error closing test database:', error);
  }
};

// Setup before all tests
beforeAll(async () => {
  await connectTestDB();
});

// Cleanup after each test
afterEach(async () => {
  await cleanupTestDB();
});

// Close connection after all tests
afterAll(async () => {
  await closeTestDB();
});

module.exports = {
  connectTestDB,
  cleanupTestDB,
  closeTestDB
};

module.exports = {
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!**/node_modules/**"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 10000, // 10 seconds for integration tests
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.js"],
  testSequencer: "<rootDir>/src/__tests__/testSequencer.js",
};

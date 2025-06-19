/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",

  // Test file patterns
  testMatch: [
    "**/__tests__/**/*.test.js",
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).js",
    "**/?(*.)+(spec|test).ts",
  ],

  // Ignore k6 performance tests
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "metrics.test.js"],

  // Transform configuration for TypeScript
  transform: {
    "^.+\\.ts$": "ts-jest",
    "^.+\\.js$": "babel-jest",
  },

  // Coverage configuration
  collectCoverageFrom: [
    "controllers/**/*.{ts,js}",
    "middleware/**/*.{ts,js}",
    "routes/**/*.{ts,js}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // Mock and test settings
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 10000,

  // File extensions and ignored paths
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],

  // TypeScript configuration
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: {
        module: "commonjs",
        target: "es2020",
        moduleResolution: "node",
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    },
  },
};

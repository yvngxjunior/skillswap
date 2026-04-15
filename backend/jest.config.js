'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.js',
    '<rootDir>/src/tests/**/*.test.js',
  ],
  globalSetup: './src/__tests__/setup.js',
  globalTeardown: './src/__tests__/teardown.js',
  forceExit: true,
  detectOpenHandles: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/database/migrate.js',
    '!src/database/seed.js',
    '!src/server.js',
    '!src/tests/**',
    '!src/__tests__/**',
    '!src/socket/**',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70, statements: 80 },
  },
  testTimeout: 15000,
  verbose: true,
};

'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  forceExit: true,
  detectOpenHandles: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/database/migrate.js',
    '!src/database/seed.js',
    '!src/server.js',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70, statements: 80 },
  },
  testTimeout: 30000,
};

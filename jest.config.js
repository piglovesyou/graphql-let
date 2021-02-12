module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60 * 1000,
  globalSetup: '<rootDir>/src/lib/__tools/global-setup.ts',
  testPathIgnorePatterns: ['/node_modules/', '__fixtures', '.__fixtures'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

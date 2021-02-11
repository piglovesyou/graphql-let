module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60 * 1000,
  globalSetup: '<rootDir>/test/__tools/global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

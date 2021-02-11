module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'test',
  testTimeout: 60 * 1000,
  globalSetup: '<rootDir>/__tools/global-setup.ts',
  globalTeardown: '<rootDir>/__tools/global-teardown.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

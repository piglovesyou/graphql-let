module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'test',
  testTimeout: 60 * 1000,
  globalSetup: '<rootDir>/__tools/global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

module.exports = {
  root: true,

  parser: '@typescript-eslint/parser',

  plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'jest'],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],

  // tsconfig.json, .eslintrc, jest.config.js should look same
  ignorePatterns: ['**/__fixtures', '**/.__fixtures'],

  env: {
    jest: true,
  },

  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};

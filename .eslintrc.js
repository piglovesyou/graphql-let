module.exports = {
  root: true,

  parser: '@typescript-eslint/parser',

  plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'jest'],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
    'prettier/babel',
    'prettier/react',
  ],

  env: {
    jest: true,
  },

  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
  }
};

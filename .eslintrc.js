module.exports = {
  parser: '@typescript-eslint/parser',

  extends: [
    'prettier',
  ],

  plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'jest'],

  parserOptions: {
    sourceType: 'module',
    project: './tsconfig.json',
  },

  env: {
    jest: true,
  },

  rules: { }
};

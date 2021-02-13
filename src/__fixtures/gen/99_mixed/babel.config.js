module.exports = {
  plugins: [
    '@babel/plugin-syntax-jsx',
    ['../../../../babel.js', { importName: 'graphql-let' }],
  ],
};

module.exports = {
  plugins: [
    "@babel/plugin-syntax-jsx",
    ["../../../src/babel.ts", { importName: 'graphql-let' }],
  ]
};

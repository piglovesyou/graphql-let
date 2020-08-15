// a webpack loader assuming to be used as
// `{test: /\.graphqls$/, loader: 'graphql-let/schema-loader'}`
module.exports = require('./dist/schemaLoader').default;

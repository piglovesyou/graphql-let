// a webpack loader assuming to be used as
// `{test: /\.graphql$/, loader: 'graphql-let/loader'}`
module.exports = require('./dist/loader').default;

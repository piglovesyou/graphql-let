module.exports = function alert() {
  console.error(`[graphql-let] Failed. Configure Babel to inject the result of Graphql Code Generator.
You may want to run it before the others.
// Your babel config file
{
  "plugins": [ "graphql-let/babel" ]
}
`)
};

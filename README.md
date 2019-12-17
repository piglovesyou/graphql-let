# react-apollo-loader

A webpack loader to make those who use [React Apollo](https://github.com/apollographql/react-apollo#readme) and [GraphQL Code Generator](https://graphql-code-generator.com/) _happier_. You can do:

```typescript jsx
import { useMyQuery } from './myQuery.graphql';

export default function(props: {}) {
  // The data is typed⚡️
  const { data, loading } = useMyQuery();
  
  return loading ? <div>loading</div> : <div>{data!.myQuery.text}</div>;
}
```

[The blog post](https://dev.to/piglovesyou/react-apollo-loader-enhance-react-apollo-typescript-and-graphql-utilization-45h0)

# Restrictions

Make sure you

* use [Apollo Client](https://github.com/apollographql/apollo-client#readme)
* use [TypeScript](https://www.typescriptlang.org/)
* have a valid GraphQL server
* are willing to have **typed** GraphQL response
* have all your GraphQL documents in `.graphql` files, not in `.tsx`
    * This's going to be the preparation for the setup

# Examples

* [Next.js TypeScript + Apollo Example](https://github.com/piglovesyou/next-example-typescript-apollo#readme)
* [Example based on React Starter Kit](https://github.com/piglovesyou/react-apollo-loader-example#readme)

# Setup

1. Install react-apollo-loader

```bash
yarn add -D react-apollo-loader
```

2. Add the line to your `.gitignore`

react-apollo-loader will generate `.d.ts` right next to your `.graphql` GraphQL document files.

```diff
# .gitignore
+*.graphql.d.ts
```

3. Make sure your GraphQL schema is able to get by [this syntax](https://github.com/ardatan/graphql-toolkit#schema-loading).

* If you have an isolated GraphQL Server, you can specify the URL endpoint, like `https://yoursite.com/graphql`.
* Another recommended way is to specify a glob like `**/*.graphqls`. `.graphqls` is the extension that
[graphql-toolkit recognizes as GraphQL schema files](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).
Note **you cannot use the same extension of GrahpQL documents**, these are different.
    * In this case, you would also want to load `.graphqls` by `graphql-tag/loader` to build executable schema. Set it up in your webpack.config.

4. Setup the GraphQL document scanner in your `webpack.config.{js,ts}`. Note: 
    * Make sure you're including only GraphQL documents, not GraphQL schema
    * The generated `.tsx` content still needs to be transpiled to `.js` so let Babel do that.

<!--https://graphql-code-generator.com/docs/getting-started/documents-field#document-scanner-->

```diff
 const config: webpack.Configuration = {
   module: {
     rules: [
+      {
+        test: /\.graphql$/,
+        use: [
+          {
+            loader: 'babel-loader',
+            options: { presets: ['@babel/preset-typescript'] },
+          },
+          {
+            loader: 'graphql-codegen-loader',
+            options: {
+              schema: path.join(__dirname, 'schema.graphql'),
+            }
+          },
+        ],
+      }
```

# Options

The required property is `schema`, where you can specify:

* URL `https://yoursite.com/graphql`
* JSON introspectino schema `schema.json`
* Schema file `schema.graphqls` or the glob `**/*.graphqls` 

[Some of the other options are available](https://github.com/dotansimha/graphql-code-generator/blob/27c0e142de6bed63402b5ef42788e84aee757f1f/packages/utils/plugins-helpers/src/types.ts#L4-L15),
but note still some of the options are overwritten by react-apollo-loader.

# License

MIT

# TODO

- [ ] Write test
- [ ] Write [webpack loader option schema](https://webpack.js.org/contribute/writing-a-loader/#loader-utilities)

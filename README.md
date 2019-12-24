# graphql-let ![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg) [![npm version](https://badge.fury.io/js/graphql-let.svg)](https://badge.fury.io/js/graphql-let)

A webpack loader to import type-protected codegen results directly from GraphQL documents. 

## Why it exists

One of the strengths of GraphQL is enforcing data types on runtime. Further, TypeScript and [GraphQL Code Generator](https://graphql-code-generator.com/) (graphql-codegen) make it safer to type data statically, so you can write truly type-protected code with rich IDE assists.

To enhance the development pattern, it's necessary to focus on a more specific use-case than what graphql-codegen allows; binding TypeScript (and assuming the use of  Apollo-Client and React). In the way, graphql-let behaves like a subset of graphql-codegen.

graphql-let lets you import graphql-codegen results directly per GraphQL documents with TypeScript type definitions by webpack Loader power.

```typescript jsx
import { useNewsQuery } from './news.grpahql'

const  News: React.FC<{}> = (props) => {
	// Typed already️⚡️
	const { data: { news } } = useNewsQuery()
	if (news) <div>{news.map(...)}</div>
}
```

## What it does behind

Two things:

* The webpack loader runs graphql-codegen with the configuration in `.graphql-let.yml`. The generated result is what you can import, such as `useNewsQuery` function in the above example.
* It also generates a file `.graphql.d.ts` by the `.graphql` so you can get data types of the graphql-codegen results.

Also a webpack-free command `graphql-let` can generate `.graphql.d.ts`. You may want to run it before a webpack build so the former type checking of `tsc` can pass. 

## How to get started

This is an example of **TypeScript + React + Apollo Client**. Help yourself to replace the corresponding lines depending on your needs.

[Here also is the example of Next.js integration](https://github.com/piglovesyou/nextjs-example-typescript-graphql#readme).

### 1. Install dependencies

```
npm install -D graphql-let @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
npm install @apollo/react-common @apollo/react-components @apollo/react-hooks
```

### 2. Configure

#### .graphql-let.yml

Run this command to have a configuration template.

```
npx graphql-let init
```

You now have a file `.graphql-let.yml` on your directory. Edit it like this:

```diff
 generateDir: __generated__
-schema: path/to/**/*.graphqls
+schema: graphql/**/*.graphqls
-documents: path/to/**/*.graphql
+documents: queries-and-mutations/**/*.graphql
 plugins:
   - typescript
+  - typescript-operations
+  - typescript-react-apollo
```

Available options:

| property | required | type | meaning | examples |
| --- | :---: | --- | --- | --- |
| `generateDir` | ✔︎ | `string` | The directory that graphql-let puts generated files. You may want to ignore the directory by `.gitignore`.
| `schema` | ✔︎ | `string` | The GraphQL schema info that graphql-let requests introspection to. [more info](https://github.com/ardatan/graphql-toolkit#schema-loading) | `http://localhost:3000/graphql`<br />`schema.json`<br />`schema.graphqls`<br />`graphql/**/*.graphqls` |
| `documents` | ✔︎ | `string` | The GraphQL documents info of quereis and mutations etc. All the documents have to be separate files. | `./queries-and-mutations/**/*.graphql` |
| `plugins` | ✔︎ | `string[]` | The plugin names of graphql-codegen. [more info](https://graphql-code-generator.com/docs/plugins/) | `typescript-react-apollo` |
| `config` |  | `Record<string, boolean \| string>` | The configuration for the plugins. [more info](https://graphql-code-generator.com/docs/getting-started/config-field)  | `withHOC: false` |

#### tsconfig.json

graphql-let will generate `.d.ts` files in `__generated__/types`. Mark the directory as one of `typeRoots` in you tsconfig.json.

```diff
 {
   "compilerOptions": {
+    "typeRoots": [
+      "node_modules/@types",
+      "__generated__/types"
+    ]
   },
```

#### .gitignore

You may want to exclude auto-generated files by graphql-let. Add this line in your .gitignore.

```diff
+__generated__
```

#### webpack.config.ts

The webpack loader also needs to be configured. Note that the content `graphql-let/loader` generates is JSX-TypeScript. You have to compile it to JavaScript with additional loader such as `babel-loader`.

```diff
 const config: Configuration = {
   module: {
     rules: [
+      {
+        test: /\.graphql$/,
+        use: [
+          { loader: 'babel-loader', options: { presets: ['@babel/preset-typescript', '@babel/preset-react'] } },
+          { loader: 'graphql-let/loader' },
+        ]
+      }
     ]
   }
 }
```

### 3. Prepare types 

Run this command, so graphql-let looks for `.graphql` GraphQL documents by the config.documents glob pattern. Then it'll generate corresponding `.grpahql.d.ts` files in the config.generateDir directory.

```
npx graphql-let
# This will generate __generated__/types/news.graphql.d.ts
```

### 4. Code more

Now you can use react-apollo hooks function with IDE code assists.

```typescript jsx
import { useNewsQuery } from './news.grpahql'

const  News: React.FC<{}> = (props) => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery()
    if (news) <div>{ news.map(...) }</div>
}
```

## FAQ

> Can I write GraphQL documents in my `.tsx` like ``const query = gql`query News{ ... }`;``?

No, you need to have separated document files to run the webpack loader. Besides, typing with that syntax would be impossible.

> What's `.graphqls`? Do I need to use `.graphqls` for schema and `.graphql` for documents?

Not exactly, but I'll recommend using such different extensions for webpack loader detection since these will want the different loaders. And `.graphqls` is one of [the supported extensions for GrpahQL schema by graphql-toolkit](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

## License

MIT

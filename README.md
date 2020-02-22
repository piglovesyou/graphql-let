# graphql-let ![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg) [![npm version](https://badge.fury.io/js/graphql-let.svg)](https://badge.fury.io/js/graphql-let)

A webpack loader to import type-protected codegen results directly from GraphQL documents. 

Try [the Next.js example](https://github.com/zeit/next.js/blob/canary/examples/with-typescript-graphql/README.md#readme) that integrates graphql-let.

## Why it exists

One of the strengths of GraphQL is [enforcing data types on runtime](https://graphql.github.io/graphql-spec/June2018/#sec-Value-Completion). Further, TypeScript and [GraphQL Code Generator](https://graphql-code-generator.com/) (graphql-codegen) make it safer by typing data statically, so you can write truly type-protected code with rich IDE assists.

To enhance the development pattern, it's necessary to focus on a more specific use-case than what graphql-codegen allows; binding TypeScript (and assuming the use of Apollo-Client and React). In the way, graphql-let behaves as a subset of graphql-codegen.

graphql-let lets you import graphql-codegen results directly per GraphQL documents with TypeScript type definitions by webpack Loader power.

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
	// Typed already️⚡️
	const { data: { news } } = useNewsQuery()
	if (news) return <div>{news.map(...)}</div>
}
```

## What it does behind

Two things:

* It runs graphql-codegen inside according to the `.graphql-let.yml` and pass the generated TypeScript source to the next loader.
* It generates a file `.d.ts`.

<p align="center"><img src="./resource/graphql-let-loader.png" /></p>

You may also want only `.d.ts` before a webpack build to check types. Run `graphql-let` command to get `.d.ts` without running webpack. 

<p align="center"><img src="./resource/graphql-let.png" /></p>

## How to get started

This is an example of **TypeScript + React + Apollo Client**. Help yourself to replace the corresponding lines depending on your needs.

### 1. Install dependencies

```
npm install -D graphql-let @graphql-codegen/cli @graphql-codegen/plugin-helpers @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
npm install @apollo/react-common @apollo/react-components @apollo/react-hooks
```

### 2. Configure

#### .graphql-let.yml

Run this command to have a configuration template.

```
npx graphql-let init
# This will generate .graphql-let.yml
```

Next add [graphql-codegen plugins](https://graphql-code-generator.com/docs/plugins/#available-plugins) in it. **Please note that you have to generate TypeScript source** by the plugins.

Edit it like this:

```diff
 generateDir: __generated__
 schema: **/*.graphqls
 documents: **/*.graphql
 plugins:
   - typescript
+  - typescript-operations
+  - typescript-react-apollo
```

Available options:

| property | required | type | meaning | examples |
| --- | :---: | --- | --- | --- |
| `generateDir` | ✔︎ | `string` | The directory that graphql-let puts generated files. You may want to ignore the directory by `.gitignore`. | `__generated__` |
| `schema` | ✔︎ | `string` | The GraphQL schema info that graphql-let requests introspection to. | <ul><li>`http://localhost:3000/graphql`</li><li>`schema.json`</li><li>`schema.graphqls`</li><li>`graphql/**/*.graphqls`</li></ul>[All available formats](https://graphql-code-generator.com/docs/getting-started/schema-field#available-formats) |
| `documents` | ✔︎ | `string \| string[]` | The GraphQL documents info of quereis and mutations etc. All the documents have to be separate files. | `./queries-and-mutations/**/*.graphql` |
| `plugins` | ✔︎ | `string[]` | The plugin names of graphql-codegen. | <ul><li>`typescript-operations`</li><li>`typescript-react-apollo`</li></ul>[All available plugins](https://graphql-code-generator.com/docs/plugins/) |
| `respectGitIgnore` | ✔︎ | `boolean` | Whether to use `.gitignore` to ignore like `node_modules`. It's passed to [globby](https://www.npmjs.com/package/globby#gitignore) internally. | `true` |
| `config` |  | `Record<string, boolean \| string>` | The configuration for the plugins. [more info](https://graphql-code-generator.com/docs/getting-started/config-field)  | `withHOC: false` |

#### tsconfig.json

graphql-let will generate `.d.ts` files in `__generated__/types`. Mark the directory as one of `typeRoots` in your tsconfig.json.

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

The webpack loader also needs to be configured. Note that the content `graphql-let/loader` generates is JSX-TypeScript. You have to compile it to JavaScript with an additional loader such as `babel-loader`.

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

Run this command to generate `.d.ts` for `.graphql`. You may want to run it every time before running `tsc`. Please check your npm scripts in `package.json`.

```
npx graphql-let
# This will generate __generated__/types/news.graphql-${hash}.d.ts
```

### 4. Code more

Enjoy the webpack Hot Module Replacement with the generated react-apollo hooks and IDE code assists.

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{ news.map(...) }</div>
}
```

## Experimental feature: Resolver Types

If you:

* have local GraphQL schema files (`.graphqls`)
* have installed [`@graphql-codegen/typescript-resolvers`](https://graphql-code-generator.com/docs/plugins/typescript-resolvers) in dependencies

, graphql-let command will generate `__concatedschema__-*.d.ts` to help you write GraphQL resolvers. Run: 

```bash
yarn add -D @graphql-codegen/typescript-resolvers

yarn graphql-let
```

then you will get `Resolver` type from any GraphQL schema files you have.

```typescript
import { Resolvers } from "./type-defs.graphqls";

const resolvers: Resolvers = {
  Query: {
    // All typed⚡️
    viewer(parent, args, context, info) {
      return { ... }
    },
  }
};

export default resolvers;
```

`graphql-let/schema/loader` is also available. It just pass GraphQL Content to the next loader but it generates resolver types. Set it up like this:

```diff
 const config: Configuration = {
   module: {
     rules: [
+      {
+        test: /\.graphqls$/,
+        use: [
+          { loader: 'graphql-tag/loader' },
+          { loader: 'graphql-let/schema/loader' },
+        ]
+      }
     ]
   }
 }
```

## FAQ

#### So, it's just a graphql-codegen wrapper generating `d.ts`...?

_Yes._

#### Is this a tool only for React?

No. There are [more plugins that also generates `.ts` from GraphQL documents](https://graphql-code-generator.com/docs/plugins/).

#### Can I write GraphQL documents in my `.tsx` as ``const query = gql`query News{ ... }`;``?

Afraid not. You need to have separate files to execute the webpack loader. Besides, typing the value of ``gql`...` `` would be impossible.

#### What's the extension `.graphqls`? Should I use it for schema and `.graphql` for documents?

Not exactly, but I'd recommend them. I think using different extensions for schema/documents leads to a more understandable configuration for webpack loaders with fewer pitfalls. Another reason for `.graphqls` is that it's one of [the supported extensions in the internal library](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

## License

MIT

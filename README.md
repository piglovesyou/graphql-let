# graphql-let ![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg) [![npm version](https://badge.fury.io/js/graphql-let.svg)](https://badge.fury.io/js/graphql-let)

A webpack loader to import type-protected codegen results directly from GraphQL documents. 

## Why it exists

One of the strengths of GraphQL is [enforcing data types on runtime](https://graphql.github.io/graphql-spec/June2018/#sec-Value-Completion). Further, TypeScript and [GraphQL Code Generator](https://graphql-code-generator.com/) (graphql-codegen) make it safer by typing data statically, so you can write truly type-protected code with rich IDE assists.

To enhance the development pattern, it's necessary to focus on a more specific use-case than what graphql-codegen allows; binding TypeScript (and assuming the use of Apollo-Client and React). In the way, graphql-let behaves like a subset of graphql-codegen.

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

* graphql-let/loader runs graphql-codegen inside according to the `.graphql-let.yml` config and generates TypeScript source, such as `useNewsQuery` function in the above example.
* It also generates a file `.d.ts` for it so all the data and functions is typed.

<p align="center"><img src="./resource/graphql-let-loader.png" /></p>

You may also want `.d.ts` before starting a webpack build for type checking purposes. Run `graphql-let` command only to get `.d.ts` without webpack. 

<p align="center"><img src="./resource/graphql-let.png" /></p>

## How to get started

This is an example of **TypeScript + React + Apollo Client**. Help yourself to replace the corresponding lines depending on your needs.

[Here is the example of Next.js integration](https://github.com/piglovesyou/nextjs-example-typescript-graphql#readme).

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

You now have a file `.graphql-let.yml` on your directory. **Please note you have to generate TypeScript source** here.

Edit like this:

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
| `generateDir` | ✔︎ | `string` | The directory that graphql-let puts generated files. You may want to ignore the directory by `.gitignore`.
| `schema` | ✔︎ | `string` | The GraphQL schema info that graphql-let requests introspection to. [more info](https://github.com/ardatan/graphql-toolkit#schema-loading) | `http://localhost:3000/graphql`<br />`schema.json`<br />`schema.graphqls`<br />`graphql/**/*.graphqls` |
| `documents` | ✔︎ | `string | string[]` | The GraphQL documents info of quereis and mutations etc. All the documents have to be separate files. | `./queries-and-mutations/**/*.graphql` |
| `plugins` | ✔︎ | `string[]` | The plugin names of graphql-codegen. [more info](https://graphql-code-generator.com/docs/plugins/) | `typescript-react-apollo` |
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

Run this command, so graphql-let looks for `.graphql` GraphQL documents by the config.documents glob pattern. Then it'll generate corresponding `.d.ts` files in the config.generateDir directory.

```
npx graphql-let
# This will generate __generated__/types/news.graphql.d.ts
```

### 4. Code more

Enjoy the generated functions of react-apollo hooks with IDE code assists.

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{ news.map(...) }</div>
}
```

## FAQ

#### Do I have to use React with graphql-let?

No, I believe. There are [more plugins that also generates `.ts` from `.graphql` documents](https://graphql-code-generator.com/docs/plugins/) where one might want the source and `.d.ts` through graphql-let.

#### Can I write GraphQL documents in my `.tsx` as ``const query = gql`query News{ ... }`;``?

Afraid not, you need to have separate document files to execute the webpack loader. Besides, typing the value of ``gql`...` `` will be impossible.

#### What's `.graphqls`? Do I need to use `.graphqls` for schema and `.graphql` for documents?

Not exactly, but I'll recommend that. I think such different extensions lead to more simple configuration for the webpack loaders with less pitfalls. And the reason for using `.graphqls` is that it's one of [the supported extensions in the core library](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

## License

MIT

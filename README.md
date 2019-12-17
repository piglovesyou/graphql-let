# graphql-let

A webpack loader to import type-protected codegen results directly from GraphQL documents. 

## Why it exists

One of streangths of GraphQL is enforcing data types on runtime. Further, TypeScript and [GraphQL Code Generator (graphql-codegen)](https://graphql-code-generator.com/) make it safer to type data statically, so you can write truly type-protected code with rich IDE assists.

To enhance the development pattern, it's necessary to focus on a more specific use-case than what graphql-codegen allows; binding TypeScript (and assuming use of Apollo-Client and React). In the way, graphql-let behaves like a subset of graphql-codegen.

graphql-let lets you import graphql-codegen results per GraphQL documents directly from the `.graphql` files with TypeScript type definitions by webpack Loader power.

```typescript jsx
import { useNewsQuery } from './news.grpahql';

const  News: React.FC<{}> = (props) => {
	// Typed already️⚡️
	const { data: { news } } = useNewsQuery();
	if (news) <div>{news.map(...)}</div>
}
```

## What it does behind

Two things:

* When webpack detects importing a GraphQL document, the loader runs graphql-codegen with what you configured in `.graphql-let.yml`. The result is what you get, such as `useNewsQuery` function in the above example.
* It generates a file `.graphql.d.ts` by the file `.graphql` so you can get GraphQL data types of what you import.

Please note:

* You may want to run `graphql-let` command before the webpack build. `graphql-let` command generates `.graphql.d.ts` files so that the `tsc` can pass the type checking.

## How to get started

This is an example of TypeScript + React + Apollo Client. Please replace the config with your preference.

### 1. Install dependencies

```
npm install -D graphql-let @graphql-codegen/core @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
npm install @apollo/react-common @apollo/react-components @apollo/react-hooks
```

### 2. Configure

graphql-let generates `.graphql.d.ts`. Ignore them from Git.

In .gitignore
```diff
+*.graphql.d.ts
```

To configure how graphql-let works, first run

```
npx graphql-let init
```

and you'll get a file `.graphql-let.yml` in the directory. Edit it like this:

```diff
-schema: path/to/**/*.graphqls
+schema: graphql/**/*.graphqls
-documents: path/to/**/*.graphql
+documents: queries-and-mutations/**/*.graphql
 plugins:
   - typescript
+  - typescript-operations
+  - typescript-react-apollo
```

| property | required | type | meaning | examples |
| --- | :---: | --- | --- | --- |
| `schema` | ✔︎ | `string` | The GraphQL schema info that graphql-let requests introspection to. [more info](https://github.com/ardatan/graphql-toolkit#schema-loading) | `http://localhost:3000/graphql`<br />`schema.json`<br />`schema.graphqls`<br />`graphql/**/*.graphqls` |
| `documents` | ✔︎ | `string` | The GraphQL documents info of quereis and mutations etc. All the documents have to be separate files. | `./queries-and-mutations/**/*.graphql` |
| `plugins` | ✔︎ | `string[]` | The plugin names of graphql-codegen. [more info](https://graphql-code-generator.com/docs/plugins/) | `typescript-react-apollo` |
| `config` |  | `Record<string, boolean \| string>` | The configuration for the plugins. [more info](https://graphql-code-generator.com/docs/getting-started/config-field)  | `withHOC: false` |

Also don't forget to setup `graphql-let/loader` in your webpack.config like this:

```diff
 const config: Configuration = {
   module: {
     rules: [
+      {
+        test: /\.graphql$/,
+        loader: 'graphql-let/loader'
+      }
     ]
   }
 };
```

### 3. Generate types 

In your react components file, temporarily write `import`. For example:

```typescript jsx
import `./news.graphql` 
```

And run

```
npx graphql-let
```

You'll get a generated file `news.graphql.d.ts` right next to the `news.graphql`.

### 4. Code more

Now you can write React components with typed react-apollo hooks function.

```typescript jsx
import { useNewsQuery } from './news.grpahql';

const  News: React.FC<{}> = (props) => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery();
    if (news) <div>{ news.map(...) }</div>
}
```

## FAQ

> Do I need to write 

## License

MIT

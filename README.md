# graphql-let [![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg)](https://github.com/piglovesyou/graphql-let/actions) [![npm version](https://badge.fury.io/js/graphql-let.svg)](https://badge.fury.io/js/graphql-let)

A tool to get typed graphql-codegen results closer to you.

Try
[the Next.js example](https://github.com/zeit/next.js/blob/canary/examples/with-typescript-graphql/README.md#readme)
that integrates graphql-let.

## Table of Contents

-   [Why it exists](#why-it-exists)
-   [How it works](#how-it-works)
-   [Get started](#get-started)
-   [Available options in .graphql-let.yml](#available-options-in-graphql-letyml)
-   [Jest Transformer](#jest-transformer)
-   [Babel Plugin for inline GraphQL documents](#babel-plugin-for-inline-graphql-documents)
-   [Experimental feature: Resolver Types](#experimental-feature-resolver-types)
-   [FAQ](#faq)
-   [Contribution](#contribution)
-   [License](#license)

## Why it exists

One of the strengths of GraphQL is
[enforcing data types on runtime](https://graphql.github.io/graphql-spec/June2018/#sec-Value-Completion).
Further, TypeScript and
[GraphQL code generator](https://graphql-code-generator.com/) (graphql-codegen)
make it safer by typing data statically, so you can write truly type-protected
code with rich IDE assists.

To enhance that development pattern, we should move on to the more specific
use-case than what GraphQL code generator allows. Let's consider TypeScript as a
first-class citizen and forget generating intermediate artifacts to achieve Hot
Module Replacement (HMR).

graphql-let lets you `import` and call `gql` to get results of GraphQL code
generator per GraphQL documents with TypeScript type definitions.

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
    // Typed already️⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{news.map(...)}</div>
}
```

## How it works

There are three entrypoints to graphql-let: a CLI, a webpack loader and a Babel
plugin. Mostly, all do the same.

1.  It loads configurations from `.graphql-let.yml`
2.  It passes them to GraphQL code generator to get `.ts(x)`s, which runtime
    will use
3.  It generates `.d.ts` for the `.ts(x)`s, which your IDE and `tsc` will use

There are a few things it works on to make it happen fast and stable.

-   Sharing the processes. Loading remote schema and generating `.d.ts`s are
    heavy, so it runs them fewer times when it's possible.
-   Caching. By embedding hashes of source states, it reduces number of
    unnecessary compilation.
-   Sharing the promises. The webpack compilation of the typical SSR
    applications as Next.js runs `"node"` and `"web"` simultaniously. If sources
    are the same, the compilation should run once.

## Get started

This is an example of **TypeScript + React + Apollo Client on webpack**. Please
replace the corresponding lines depending on your needs.

### 1. Install dependencies

Note graphql-let is `devDependencies`.

```bash
yarn add -D graphql-let @graphql-codegen/cli @graphql-codegen/plugin-helpers @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
yarn add @apollo/react-common @apollo/react-components @apollo/react-hooks
```

### 2. Configure .graphql-let.yml

Run this command to generate a configuration template.

```bash
yarn graphql-let init
# This will generate .graphql-let.yml
```

Next add
[graphql-codegen plugins](https://graphql-code-generator.com/docs/plugins/index)
in it. **Please note that you have to generate TypeScript source** by the
plugins.

Edit it like this:

```diff
 schema: lib/type-defs.graphqls
 documents: '**/*.graphql'
 plugins:
   - typescript
+  - typescript-operations
+  - typescript-react-apollo
```

### 3. Configure .gitignore

graphql-let will generate `.d.ts` files in the same folder of `.graphql`. Add
these lines in your .gitignore.

```diff
+*.graphql.d.ts
+*.graphqls.d.ts
```

### 4. Configure webpack.config.ts

The webpack loader also needs to be configured. Note that the content that
`graphql-let/loader` generates is JSX-TypeScript. You have to compile it to
JavaScript with an additional loader such as `babel-loader`.

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

### 5. Generate type declarations

Run this to generate `.d.ts`.

```bash
yarn graphql-let

# This will generate files such as:
#   - src/query.graphql.d.ts
#   - src/schema.graphqls.d.ts
```

By `--config` option you can specify the custom path to the `.graphql-let.yml`.
The directory .graphql-let.yml is located at is the basepath of the relative
paths in .grpahql-let.yml. Also, the basepath should be identical to **webpack's
`config.context`** so the loader can find the config file.

```bash
pwd # "/app"
yarn graphql-let --config custom/path/.graphql-let.yml

# This will point paths such as:
# /app/custom/path/src/query.graphql.d.ts
# /app/custom/path/src/schema.graphqls.d.ts
```

You may want to run it everytime calling `tsc`. Please check your `package.json`
and modify like this.

```diff
   "scripts": {
-     "build": "tsc"
+     "build": "graphql-let && tsc"
   },
```

### 4. Code more

Enjoy HMR (Hot Module Replacement) of webpack with the generated react-apollo
hooks and IDE code assists.

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{ news.map(...) }</div>
}
```

## Available options in .graphql-let.yml

These are the available options in `.graphql-let.yml`.

```yaml
schema: lib/type-defs.graphqls
# Required. The GraphQL schema info that graphql-let requests introspection to.
# Examples:
#       schema: http://localhost:3000/graphql
#       schema: schema.json
#       schema: schema.graphqls  # Note: glob is not supported yet
#       schema:
#           https://api.github.com/graphql
#               headers:
#                   Authorization: "YOUR-TOKEN"
# Please see here for more information: https://graphql-code-generator.com/docs/getting-started/schema-field#available-formats

documents: "**/*.graphql"
# Required by both "graphql-let/loader" and "graphql-let/babel".
# The GraphQL documents info of quereis and mutations etc.
# Examples:
#            documents: 'queries/**/*.graphql'
#            documents:
#                - 'queries/**/*.graphql'
#                - 'pages/**/*.tsx'
#                - '!queries/exeption.graphql'

plugins:
    - typescript
    - typescript-operations
    - typescript-react-apollo
# Required. The plugins for GraphQL documents to run GraphQL code generator with.
# It's identical to "documentPlugins" field. Please note you need to generate TypeScript source here.
# Examples:
#            plugins:
#                - typescript
#                - typescript-react-apollo
#                - add: "/* eslint-disable */"
# See here for more information. https://graphql-code-generator.com/docs/plugins/index

config:
    - withHOC: false
    - withHooks: true
# Optional. Shared options for document plugins.
# See here for more information. https://graphql-code-generator.com/docs/getting-started/config-field

respectGitIgnore: true
# Optional, `true` by default. If true, graphql-let will ignore files in .gitignore.
# Useful to prevent parsing files in such as `node_modules`.

cacheDir: node_modules/graphql-let/__generated__
# Optional, `node_modules/graphql-let/__generated__` by default.
# graphql-let takes care of intermediate outpus `.ts(x)`s of GraphQL code generator but still need to
# store them somewhere for caching and TypeScript API purposes. This is the directory these files go to.
# Examples:
#            cacheDir: __generated__

TSConfigFile: tsconfig.json
# Optional, `tsconfig.json` by default. You can specify a custom config for generating `.d.ts`s.
# Examples:
#            TSConfigFile: tsconfig.compile.json

gqlDtsEntrypoint: node_modules/@types/graphql-let/index.d.ts
# Optional, `node_modules/@types/graphql-let/index.d.ts` by default. Needs to be end with ".d.ts".
# It is used for a Babel plugin "graphql-let/babel" to inject types of `gql` functions.
```

## Jest Transformer

`graphql-let/jestTransformer` is available. Configure your `jest.config.js` as:

```javascript
module.exports = {
    transform: {
        "\\.graphql$": "graphql-let/jestTransformer",
    },
};
```

### Use `babel-jest` in Jest

`babel-jest` is the default subsequent transformer of
`graphql-let/jestTransformer`. Install these:

```bash
yarn add -D graphql-let babel-jest
```

And make sure your babel config can compile generated `.ts(x)`s.

### Use `ts-jest` or other subsequent transformers in Jest

The option `subsequentTransformer` is available. If you use `ts-jest`, your
`jest.config.js` will look like this:

```javascript
const { defaults: tsjPreset } = require("ts-jest/presets");

module.exports = {
    preset: "ts-jest",
    transform: {
        ...tsjPreset.transform,
        "\\.graphql$": [
            "graphql-let/jestTransformer",
            { subsequentTransformer: "ts-jest" },
        ],
    },
};
```

### Transform `.graphqls` in Jest

If you use `graphql-let/schema/loader`, you may want a corresponding
transformer, but remember graphql-let does not transform the content of GraphQL
schema. Just use what you need, it's most likely to be `jest-transform-graphql`.

```javascript
module.exports = {
    transform: {
        "\\.graphql$": "graphql-let/jestTransformer",
        "\\.graphqls$": "jest-transform-graphql",
    },
};
```

## Babel Plugin for inline GraphQL documents

A Babel Plugin support allows you to get typed graphql-codegen results from
"graphql-tag"-like syntax as the below.

```typescript jsx
import gql from "graphql-let";

// Typed️⚡️
const { useViewerQuery } = gql(`
    query Viewer {
        viewer { name }
    }
`);
```

### Configure `graphql-let/babel`

Install these additional dependencies:

```bash
yarn add -D graphql-let do-sync @babel/core @babel/parser @babel/traverse @babel/helper-plugin-utils
```

Add target `.ts(x)`s to `documents` that contains `gql()` calls. This is used
for the CLI execution.

```yaml
documents:
    - "pages/**/*.tsx"
    - "**/*.graphql"
```

Put `graphql-let/babel` to plugins section in your babel configuration such as
`babel.config.json`.

```json
{
    "plugins": ["graphql-let/babel"]
}
```

Note: The `.tsx`s are generated in `node_modules/graphql-let/__generated__` by
default, but you may want them to be outside of `node_modules` since it's often
excluded to be TS compilation. Please try `cacheDir: __generated__` in your
.graphql-let.yml then.

### Limitations of `graphql-let/babel`

-   **Sadly**, type injection can't be done with TaggedTemplateExpression such
    as `` gql`query {}` ``. This is the limitation of TypeScript.
    [Please answer me if you have ideas.](https://stackoverflow.com/questions/61917066/can-taggedtempalte-have-overload-signatures-with-a-certain-string-literal-argume)
-   Fragments are still not available. Please watch
    [the issue.](https://github.com/piglovesyou/graphql-let/issues/65)

## Experimental feature: Resolver Types

If:

-   your `schema` in .graphql-let.yml points to a single local GraphQL schema
    file (`.graphqls`)
-   you have installed
    [`@graphql-codegen/typescript-resolvers`](https://graphql-code-generator.com/docs/plugins/typescript-resolvers)
    in dependencies

, graphql-let will generate `.graphqls.d.ts` to help you type your GraphQL
resolvers. Run:

```bash
yarn add -D @graphql-codegen/typescript-resolvers

yarn graphql-let
```

then you will get `Resolver` type from the schema file.

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

`graphql-let/schema/loader` is also available. It just pass GraphQL Content to
the next loader but it updates resolver types in HMR. Set it up as below:

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

#### What's the difference between webpack loader and Babel Plugin?

The webpack loader is more stable, the Babel Plagin can handle inline GraphQL
documents.

| features                                                     | webpack loader | Babel Plugin |
| ------------------------------------------------------------ | -------------- | ------------ |
| stability/speed                                              | ✅             |              |
| generating `.d.ts`s by cli                                   | ✅             | ✅           |
| Importing GraphQL document file<br>as `import './a.graphql'` | ✅             |              |
| Inline GraphQL<br>as `` gql(`query {}`) ``                   |                | ✅           |
| Experimental: Resolver Types for<br>GraphQL schema           | ✅             |              |

#### Is this a tool only for React?

No. There are
[more plugins that also generates `.ts(x)`s from GraphQL documents](https://graphql-code-generator.com/docs/plugins/).

#### Can I write GraphQL documents in my `.tsx` as `` const query = gql`query News{ ... }`; ``?

Please try the Babel Plugin `graphql-let/babel`, but you need parensesis
(`` gql(`query {}`) ``).

#### What's the extension `.graphqls`? Should I use it for schema and `.graphql` for documents?

Not exactly, but I'd recommend them. I think using different extensions for
schema/documents leads to a more understandable configuration for webpack
loaders with fewer pitfalls. Another reason for `.graphqls` is that it's one of
[the supported extensions in the internal library](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

#### How to integrate Apollo refetchQueries?

[Query document exports `DocumentNode` named `${QueryName}Document` that you can make use of.](https://github.com/piglovesyou/graphql-let/issues/66#issuecomment-596276493)

#### How to import `.graphql` from another document, especially GraphQL Fragment?

You can't, yet.
[Please watch the progress.](https://github.com/piglovesyou/graphql-let/issues/65)

## Contribution

-   **[Create an issue](https://github.com/piglovesyou/graphql-let/issues/new)**
    if you have ideas, found a bug or anything.
-   **Creating a PR** is always welcome!
    -   Running `npm run prepublishOnly` localy will get your local development
        ready.
    -   Adding test is preferrable. But don't hesitate without it, maybe someone
        else will fill it.

## License

MIT

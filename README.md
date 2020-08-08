# graphql-let [![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg)](https://github.com/piglovesyou/graphql-let/actions) [![npm version](https://badge.fury.io/js/graphql-let.svg)](https://badge.fury.io/js/graphql-let)

A tool to get typed graphql-codegen results closer to you.

Try
[the Next.js example](https://github.com/zeit/next.js/blob/canary/examples/with-typescript-graphql/README.md#readme)
that integrates graphql-let.

## Table of Contents

-   [Why it exists](#why-it-exists)
-   [How it works](#how-it-works)
-   [Get started with webpack loader](#get-started-with-webpack-loader)
-   [Configuration options are mosly same as `codegen.yml` except:](#configuration-options-are-mosly-same-as-codegenyml-except)
-   [Setup Babel Plugin for inline GraphQL documents](#setup-babel-plugin-for-inline-graphql-documents)
-   [Jest Transformer](#jest-transformer)
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
use-case than what GraphQL code generator allows; Consider TypeScript as a
first-class citizen and forget intermediate artifacts to get Hot Module
Replacement (HMR) work.

graphql-let lets you `import` and call `gql` to get results of GraphQL code
generator per GraphQL documents with TypeScript type definitions.

```typescript jsx
import { useNewsQuery } from './news.graphql'
// or
import gql from 'graphql-let'
const { useNewsQuery } = gql(`query News { ... }`)

const News: React.FC = () => {
    // Typed already️⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{news.map(...)}</div>
}
```

## How it works

There are three entry points to graphql-let: CLI, webpack loader, and Babel
plugin. Mostly, all do the same as below.

1.  It loads configurations from `.graphql-let.yml`
2.  It builds codegen context from glob patterns from the config, a file content
    from webpack or an AST from Babel).
3.  It passes these to GraphQL code generator to get `.ts(x)`s, which runtime
    will make use of
4.  It generates `.d.ts` for the `.ts(x)`s, which your IDE and `tsc` will use

There are a few things graphql-let works on to make it happen fast and stable.

-   Sharing the processes. Generating files is expensive, so it runs less time
    to run GraphQL code generator and TypeScript API.
-   Caching. By embedding hashes of source states, it reduces the number of
    unnecessary generation.
-   Sharing the promises. The webpack compilation in typical SSR applications as
    Next.js runs [targets](https://webpack.js.org/concepts/targets/) of `"node"`
    and `"web"` simultaneously. If sources are the same, the compilation should
    run at a time.

## Get started with webpack loader

This is an example of **TypeScript + React + Apollo Client on webpack**. Please
replace the corresponding lines depending on your needs.

### 1. Install dependencies

Note graphql-let is `devDependencies`.

```bash
yarn add -D graphql-let @graphql-codegen/cli @graphql-codegen/plugin-helpers @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
yarn add @apollo/client
```

### 2. Configure .graphql-let.yml

Run this command to generate a configuration template.

```bash
yarn graphql-let init
# This will generate .graphql-let.yml
```

Next, add
[graphql-codegen plugins](https://graphql-code-generator.com/docs/plugins/index)
in it. **Please note that you have to generate a TypeScript source** by the
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

You may want to run it every time calling `tsc`. Please check your
`package.json` and modify like this.

```diff
   "scripts": {
-     "build": "tsc"
+     "build": "graphql-let && tsc"
   },
```

### 6. Code more

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

## Configuration options are mosly same as `codegen.yml` except:

graphql-let passes most of options to GraphQL code generator, so
**`.graphql-let.yml` is mostly compatible to `codegen.yml`. However**, some of
them are strictly controlled by graphql-let where you can't decide what to
generate.

### Exception: `generates`

`generates` is strictly controlled under graphql-let. Rather, think graphql-let
as a tool to let you forget intermediate outputs and import/call GraphQL
directly.

Therefore, we don't support output-file level configuration such as
[Output-file level schema](https://graphql-code-generator.com/docs/getting-started/schema-field#output-file-level),
[Output-file level documents](https://graphql-code-generator.com/docs/getting-started/documents-field#output-file-level)
and
[Output Level config](https://graphql-code-generator.com/docs/getting-started/config-field#output-level)
right now. But this could be changed logically, so please
[vote by issuing](https://github.com/piglovesyou/graphql-let/issues) if you'd
like.

### Limitation: `documents` expects only `string | string[]`

Documens-pointer level options such as `noRequire: true` or
[Custom Document Loader](https://graphql-code-generator.com/docs/getting-started/documents-field#custom-document-loader)
are not supported.

### Limitation: `` gql(`query{}`) `` is allowed only in `.ts(x)`s

Currently, `` gql(`query{}`) `` can be handled only for files with extensions
`.ts` and `.tsx`.

graphql-tag-pluck, which GraphQL code generator uses under the hood, plucks
GraphQL documents/schema from sources such as `.flow` and `.vue`. graphql-let
doesn't use it since it focuses plucking and graphql-let has to modify each
`gql` calls in the source. Also,
[graphql-tag-pluck -related configuration](https://graphql-code-generator.com/docs/getting-started/documents-field#graphql-tag-pluck)
will be ignored. If you're a Vue user, please
[vote](https://github.com/piglovesyou/graphql-let/issues).

### graphql-let specific options

In addition to `codegen.yml` options, graphql-let accepts these.

```yaml
# "plugins", required. The plugins for GraphQL documents to run GraphQL code
# generator with. Please note that you need to generate a TypeScript source here.
# See here for more information. https://graphql-code-generator.com/docs/plugins/index
# Example:
plugins:
    - typescript
    - typescript-operations
    - typescript-react-apollo
    - add: "/* eslint-disable */"

# "respectGitIgnore", optional. `true` by default.
# If true, graphql-let will ignore files in .gitignore.
# Useful to prevent parsing files in such as `node_modules`.
respectGitIgnore: true

# "cacheDir", optional. `node_modules/graphql-let/__generated__` by default.
# graphql-let takes care of intermediate `.ts(x)`s that GraphQL code generator
# generates, but we still need to write them on the disk for caching and
# TypeScript API purposes. This is the directory we store them to.
# Examples:
cacheDir: node_modules/graphql-let/__generated__
cacheDir: __generated__

# "TSConfigFile", optional. `tsconfig.json` by default.
# You can specify a custom config for generating `.d.ts`s.
# Examples:
TSConfigFile: tsconfig.json
TSConfigFile: tsconfig.compile.json

# #gqlDtsEntrypoint", optional.
# `node_modules/@types/graphql-let/index.d.ts` by default. Needs to end with ".d.ts".
# Used as an entrypoint and directory of generated type declarations for `gql()` calls.
gqlDtsEntrypoint: node_modules/@types/graphql-let/index.d.ts

```

Simple example:

```yaml
schema: schema/type-defs.graphqls
documents:
    - "**/*.graphql"
    - "!shouldBeIgnored1"
plugins:
    - typescript
    - typescript-operations
    - typescript-react-apollo
```

Example with a bit more compilicated options:

```yaml
schema:
    - https://api.github.com/graphql:
          headers:
              Authorization: YOUR-TOKEN-HERE
documents:
    - "**/*.graphql"
    - "!shouldBeIgnored1"
plugins:
    - typescript
    - typescript-operations
    - typescript-react-apollo
respectGitIgnore: true
config:
    useIndexSignature: true
    reactApolloVersion: 3
    apolloReactComponentsImportFrom: "@apollo/client/react/components"
    useIndexSignature: true
cacheDir: __generated__
TSConfigFile: tsconfig.compile.json
gqlDtsEntrypoint: typings/graphql-let.d.ts
```

## Setup Babel Plugin for inline GraphQL documents

A Babel Plugin allows you to get codegen results from "graphql-tag"-like syntax
as below.

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

```diff
 documents:
+  - "pages/**/*.tsx"
   - "**/*.graphql"
```

Put `graphql-let/babel` to the plugins section in your babel configuration such
as `babel.config.json`.

```diff
 {
   "plugins": [
+    "graphql-let/babel"
   ]
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

## Jest Transformer

`graphql-let/jestTransformer` is available. Configure your `jest.config.js` as:

```diff
  module.exports = {
    transform: {
+     "\\.graphql$": "graphql-let/jestTransformer",
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

```diff
  const { defaults: tsjPreset } = require("ts-jest/presets");

  module.exports = {
    preset: "ts-jest",
    transform: {
      ...tsjPreset.transform,
+     "\\.graphql$": [
+       "graphql-let/jestTransformer",
+       { subsequentTransformer: "ts-jest" },
+     ],
    },
  };
```

### Transform `.graphqls` in Jest

If you use `graphql-let/schema/loader`, you may want a corresponding
transformer, but remember graphql-let does not transform the content of GraphQL
schema. Just use what you need, it's most likely to be `jest-transform-graphql`.

```diff
  module.exports = {
    transform: {
      "\\.graphql$": "graphql-let/jestTransformer",
+     "\\.graphqls$": "jest-transform-graphql",
    },
  };
```

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

#### Supported combination? / x + y don't work!

Basically both syntax `import './a.graphql'` and `` gql(`query {}` ) `` are
suposed to just work, but currently some of combinations require more effort.
Please vote by creating issues.
[Sponsering me](https://github.com/sponsors/piglovesyou) is another way to get
my attention🍩🍦

These are the states/tools for the syntaxes.

| states/tools for syntax                            | File import as<br>`import './a.graphql';`                            | Inline GraphQL as<br>`import gql from 'graphql-tag';`<br>`` gql(`query {}` ); `` |
| -------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| generating `.d.ts`s by command `graphql-let`       | ✅                                                                   | ✅                                                                               |
| webpack loader `graphql-let/loader`                | ✅                                                                   | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |
| Bable Plugin `graphql-let/babel`                   | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues) | ✅                                                                               |
| Jest Transformer `graphql-let/jestTransfomer`      | ✅                                                                   | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |
| Experimental: Resolver Types for<br>GraphQL schema | ✅ by<br>`import './schema.graphqls'`                                | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |

#### Is this a tool only for React?

No. There are
[more plugins that also generates `.ts(x)`s from GraphQL documents](https://graphql-code-generator.com/docs/plugins/).

#### Can I write GraphQL documents in my `.tsx` as `` const query = gql`query News{ ... }`; ``?

Please try the Babel Plugin `graphql-let/babel`, but you need parenthesis
`` gql(`query {}`) ``.

#### What's the extension `.graphqls`? Should I use it for schema and `.graphql` for documents?

Not exactly, but I'd recommend them. I think using different extensions for
schema/documents leads to a more understandable configuration for webpack
loaders with fewer pitfalls. Another reason for `.graphqls` is that it's one of
[the supported extensions in the internal library](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

#### How to integrate Apollo refetchQueries?

[Query document exports `DocumentNode` named `${QueryName}Document` that you can make use of.](https://github.com/piglovesyou/graphql-let/issues/66#issuecomment-596276493)

#### How to import `.graphql` from another document, especially GraphQL Fragment?

Thanks to `graphql-tools/import`, the syntax
`# import X from './fragment.graphql'` is supported.

Define your fragment named as `partial.graphql`

```graphql
fragment Partial on User {
    id
    name
}
```

and import it.

```graphql
# import Partial from './partial.graphql'

query Viewer {
    viewer {
        ...Partial
    }
}
```

## Contribution

-   **[Create an issue](https://github.com/piglovesyou/graphql-let/issues/new)**
    if you have ideas, found a bug or anything.
-   **Creating a PR** is always welcome!
    -   Running `npm run prepublishOnly` locally will get your local development
        ready.
    -   Adding tests is preferable, but don't hesitate without it, maybe someone
        else will fill it.

## License

MIT

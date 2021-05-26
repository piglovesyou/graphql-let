# graphql-let [![Node CI](https://github.com/piglovesyou/graphql-let/actions/workflows/nodejs.yml/badge.svg?branch=main)](https://github.com/piglovesyou/graphql-let/actions/workflows/nodejs.yml) [![npm version](https://badgen.net/npm/v/graphql-let)](https://www.npmjs.com/package/graphql-let) [![downloads](https://badgen.net/npm/dm/graphql-let)](https://www.npmjs.com/package/graphql-let) [![Babel Macro](https://img.shields.io/badge/babel--macro-%F0%9F%8E%A3-f5da55.svg?style=flat-square)](https://github.com/kentcdodds/babel-plugin-macros)

A webpack loader/babel-plugin/babel-plugin-macros/CLI/generated file manager of
GraphQL code generator.

Try
[Create React App example](https://github.com/piglovesyou/cra-template-graphql#readme)
and
[Next.js example](https://github.com/zeit/next.js/blob/canary/examples/with-typescript-graphql/README.md#readme)
integrating graphql-let. [A blog post](https://the-guild.dev/blog/graphql-let)

🛰 **[Migration guide to v0.18.0](https://github.com/piglovesyou/graphql-let/releases/tag/v0.18.0)**

## Table of Contents

-   [Why this exists](#why-this-exists)
-   [Entrypoints and features](#entrypoints-and-features)
-   [Getting started with webpack loader](#getting-started-with-webpack-loader)
-   [Getting started with babel-plugin-macros](#getting-started-with-babel-plugin-macros)
-   [Getting started with Babel Plugin](#getting-started-with-babel-plugin)
-   [Difference between .graphql-let.yml and codegen.yml](#difference-between-graphql-letyml-and-codegenyml)
-   [Jest Transformer](#jest-transformer)
-   [Experimental feature: Resolver Types](#experimental-feature-resolver-types)
-   [FAQ](#faq)
-   [Contribution](#contribution)
-   [License](#license)

## Why this exists

One of the strengths of GraphQL is
[enforcing data types on runtime](https://graphql.github.io/graphql-spec/June2018/#sec-Value-Completion).
Further, TypeScript and
[GraphQL code generator](https://graphql-code-generator.com/) help it even safer
by typing your codebase statically. Both make a truly type-protected development
environment with rich IDE assists.

graphql-let enhances that development pattern by minimizing configuration setup,
introducing intuitive syntax, and comfortable development experience through HMR
(hot module replacement).

```typescript jsx
import { useNewsQuery } from './news.graphql' // webpack
// or
import { gql, load } from "graphql-let/macro" // babel-plugin-macros
const { useNewsQuery } = gql("query News { braa }")

const News: React.FC = () => {
    // Typed already️⚡️
    const { data: { news } } = useNewsQuery()
    return <div>{news.map(...)}</div>
}
```

## Entrypoints and features

Summary of characteristics of each entrypoint.

-   **CLI** for efficient code generation before your type checking
-   **webpack loader** to get HMR even on modifying GraphQL documents
-   **babel-plugin-macros** for the minimum configuration
-   **Babel plugin** if you don't want babel-plugin-macros

All of them mostly do the same behind the scene.

1.  Loads your configuration from `.graphql-let.yml`
2.  Finds GraphQL documents (queries, mutations, subscriptions) from `.graphql*`
    and `.ts*` specified in your `config.documents`
3.  Processes and passes arguments to GraphQL code generator **to generate
    `.ts*` s**. These are used for runtime.
4.  It also **generates the corresponding `.d.ts` s** of the codegen results.
    These are used for typing checking / IDE code completion.

Note there are a few differences between the entrypoints.

<details>
  <summary>Syntax table for the entrypoints</summary>
    <table>
        <tr>
            <th>Entry pointsYou need .graphql-let.yml and:</th>
            <th>Getting codegen result from</th>
            <th>Use values of codegen result</th>
            <th>Use types of codegen result</th>
            <th>Pros/Cons</th>
        </tr>
        <tr>
            <th rowspan="2" align="left">webpack loader<br /><br />Configure <code>"graphql-let/loader"</code><br /> to files <code>"/.*\.(tsx?|graphql)$/"</code> in webpack.config.(js|ts)</td>
            <td>File</td>
            <td colspan="2">✅ Import both value and types from a GraphQL document as a module.<pre>import { useQuery, Query } from "./a.graphql"</pre></td>
            <td rowspan="2">HMR works as expected.<br />Webpack config is required even though your project only uses Babel</td>
        </tr>
        <tr>
            <td>String literal</td>
            <td>✅ by<pre>import { gql } from "graphql-let" <br /><br />const { useQuery } = gql("query A { braa }")</pre></td>
            <td>⚠️ You can, but you have to find the internal d.ts.<pre>import { gql } from "graphql-let"<br />import {Query} from 'graphql-let/__generated__/index-A'<br /><br />const { useQuery } = gql("query { braa }")</pre></td>
        </tr>
        <tr>
            <th rowspan="2" align="left">babel-plugin-macros<br /><br />If you've already setupbabel-plugin-macros,no config needed any more</td>
            <td>File</td>
            <td>✅ by<pre>import { load } from "graphql-let/macro"<br /><br />const { useQuery } = load("./a.graphql")</pre></td>
            <td>⚠️ You can, but you have to find the internally generated d.ts.<pre>import { load } from "graphql-let/macro"<br />import {Query} from 'graphql-let/__generated__/index-A'<br /><br />const { useQuery } = load("./a.graphql")</pre></td>
            <td rowspan="2">Easiest to integrate if your project already has babel-plugin-macros. create-react-app is the great fit.Cannot load types from function call.<br /><br />Modifying *.graphql doesn't emit HMR.</td>
        </tr>
        <tr>
            <td>String literal</td>
            <td>✅ by<pre>import { gql } from "graphql-let/macro"<br /><br />const { useQuery } = gql("query A { braa }")</pre></td>
            <td>⚠️ You can, but you have to find the internally generated d.ts.<pre>import { gql } from "graphql-let/macro"<br />import {Query} from 'graphql-let/__generated__/index-A'<br /><br />const { useQuery } = gql("query { braa }")</pre></td>
        </tr>
        <tr>
            <th rowspan="2" align="left">babel-plugin<br /><br />Put "graphql-let/babel"to you .babelrc as a plugin</td>
            <td>File</td>
            <td>✅ by<pre>import { load } from "graphql-let"<br /><br />const { useQuery } = load("./a.graphql")</pre></td>
            <td>⚠️ You can, but you have to find the internally generated d.ts.<pre>import { load } from "graphql-let"<br />import {Query} from 'graphql-let/__generated__/index-A'<br /><br />const { useQuery } = load("./a.graphql")</pre></td>
            <td rowspan="2">Mostly equivalent to babel-plugin-macros, but you always need your .babelrc configuration. Possibly, "import "./a.graphql"" could be implemented, but not supported yet.Cannot load types from function call.<br /><br />Modifying *.graphql doesn't emit HMR.Possibly I can make "--watch" option butlots to do for dependency management to detect file change.</td>
        </tr>
        <tr>
            <td>String literal</td>
            <td>✅ by<pre>import { gql } from "graphql-let"<br /><br />const { useQuery } = gql("query A { braa }")</pre></td>
            <td>⚠️ You can, but you have to find the internally generated d.ts.<pre>import { gql } from "graphql-let"<br />import {Query} from 'graphql-let/__generated__/index-A'<br /><br />const { useQuery } = gql("query { braa }")</pre></td>
        </tr>
    </table>
</details>

<details>
  <summary>Efficiency</summary>

There are things to make graphql-let light and stable.

-   Sharing the processes. Generating files is expensive, so it runs less time
    to run GraphQL code generator and TypeScript API.
-   Caching. Embedding hashes, as your source states, reduces the number of
    unnecessary processing.
-   Sharing the promises. The webpack compilation in typical SSR applications as
    Next.js runs [targets](https://webpack.js.org/concepts/targets/) of `"node"`
    and `"web"` simultaneously. If sources are the same, the compilation should
    be once.

</details>

## Getting started with webpack loader

This is an example of **TypeScript + React + Apollo Client on webpack**. You may
want
[TypeScript Vue Apollo](https://www.graphql-code-generator.com/docs/plugins/typescript-vue-apollo)
or
[TypeScript Urql](https://www.graphql-code-generator.com/docs/plugins/typescript-urql).
Please replace the corresponding lines depending on your needs.

### 1. Install dependencies

Note graphql-let is in `devDependencies`.

```bash
# Prerequisites
yarn add -D typescript graphql

# Install graphql-let with its peer dependencies
yarn add -D graphql-let @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/import-types-preset

# Install GraphQL code generator plugins depending on your needs. These are in `plugins` of your .graphql-let.yml.
yarn add -D @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo

# Other libraries depending on your scenario
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
  documents:
    - '**/*.graphql'
    - '**/*.tsx'
  plugins:
+   - typescript-operations
+   - typescript-react-apollo
```

### 3. Check your `cacheDir`

`cacheDir` will have `.ts(x)`s that your sources will import. It's
`node_modules/.cache/graphql-let` by default, but you may exclude `node_modules`
for webpack compilation. In that case, we recommend setting up like this.

```diff
  schema: lib/type-defs.graphqls
  documents:
    - '**/*.graphql'
    - '**/*.tsx'
  plugins:
    - typescript-operations
    - typescript-react-apollo
+ cacheDir: .cache
```

Please note that files in `cacheDir` are only intermediate cache, possibly having wrong import paths. Your `tsconfig.json` probably complains, so give it a line for exclusion.

```diff
  // tsconfig.json
  {
+   "excludes": [".cache"]
  }
```
Also, remember you have to `.gitignore` the `.cache` directory in the next section.

### 3. Add lines to .gitignore

graphql-let will generate `.d.ts` files in the same folder of `.graphql`. Add
these lines in your .gitignore.

```diff
+ *.graphql.d.ts
+ *.graphqls.d.ts
+ /.cache
```

### 4. Configure webpack.config.ts

The webpack loader also needs to be configured. Note that the content that
`graphql-let/loader` generates is JSX-TypeScript. You have to compile it to
JavaScript with an additional loader such as `babel-loader`.

```diff
  const config: Configuration = {
    module: {
      rules: [
+       {
+         test: /\.(tsx|graphql)$/,
+         use: [
+           { loader: 'babel-loader', options: { presets: ['@babel/preset-typescript', '@babel/preset-react'] } },
+           { loader: 'graphql-let/loader' },
+         ]
+       }
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

By `--config` option, you can specify the custom path to the `.graphql-let.yml`.
The directory .graphql-let.yml is located at **is the basepath of** the relative
paths in .grpahql-let.yml. Also, the basepath should be identical to webpack's
`config.context` so the loader can find the config file.

```bash
pwd # "/app"
yarn graphql-let --config custom/path/.graphql-let.yml

# This will point paths such as:
# /app/custom/path/src/query.graphql.d.ts
# /app/custom/path/src/schema.graphqls.d.ts
```

You may want to run it every time before calling `tsc`. Please check your
`package.json` and modify like this.

```diff
   "scripts": {
-     "build": "tsc"
+     "build": "graphql-let && tsc"
   },
```

### 6. Run `webpack serve` and Code

Enjoy HMR (Hot Module Replacement) of webpack with the generated react-apollo
hooks and IDE code assists.

```typescript jsx
import { gql } from 'graphql-let'
import { useNewsQuery } from './news.graphql'

const { useViewerQuery } = gql(`query Viewer { blaa }`)

const News: React.FC = () => {
    // Already typed⚡️
    const { data: { news } } = useNewsQuery()
    const { data: { viewer } } = useViewerQuery()
    return <div>{ news.map(...) }</div>
}
```

## Getting started with babel-plugin-macros

[babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros)
requires the least configuration to setup.

Please finish [1. Install dependencies](#1-install-dependencies), and
[2. Configure .graphql-let.yml](#2-configure-graphql-letyml) as you still need
.graphql-let.yml.

### 3. Make sure your babel-plugin-macros is ready

[Put a line `"plugins": ["macros"]` to your .babelrc](https://github.com/kentcdodds/babel-plugin-macros/blob/main/other/docs/user.md#via-babelrc-recommended).
If you use [Create React App](https://create-react-app.dev/), it contains
babel-plugin-macros out of the box.

If you want a custom path to .graphql-let.yml, you can use `configFilePath`
babel option. `<projectRoot>${configFilePath}` should point to your
.graphql-let.yml.

### 4. Code

Thanks to babel-plugin-macros's beautiful architecture, you're ready to use
GraphQL codegen values.

```typescript jsx
import { gql, load } from "graphql-let/macro"

// Typed⚡️
const { useNewsQuery } = gql("query News { braa }")
const { useViewerQuery } = load("./viewer.graphql")
```

Note that your schema types are generated in
`graphql-let/__generated__/__types__`, instead of per-document outputs.

```typescript jsx
import { News } from 'graphql-let/__generated__/__types__'
```

## Getting started with Babel Plugin

Mostly the same as babel-plugin-macros, only you need to `import "graphql-let"`.

Please finish [1. Install dependencies](#1-install-dependencies) and
[2. Configure .graphql-let.yml](#2-configure-graphql-letyml) as you still need
.graphql-let.yml.

### 3. Setup .babelrc

```diff
  {
+   "plugins": ["graphql-let/babel"]
  }
```

### 4. Code

```typescript jsx
import { gql, load } from "graphql-let"

const { useNewsQuery } = gql("query News { braa }")
const { useViewerQuery } = load("./viewer.graphql")
```

## Difference between .graphql-let.yml and codegen.yml

graphql-let half passes your config options to GraphQL code generator API and
half controls them. Here explains how different these and why. You can see this
section as a migration guide, too.

```diff
  schema: https://api.github.com/graphql
  documents: "**/*.graphql"
- generates:
-     ./__generated__/operations.ts:
-         config:
-             key: value
-         plugins:
-             - typescript
-             - typescript-operations
-         preset: xxx
+ plugins:
+     - typescript-operations
+ config:
+     key: value
```

### Plugin `typescript` should not be specified

You have to have `@graphql-codegen/typescript` as a dev dependency. graphql-let
generates types **by default**, where it uses the plugin. The `plugins` in
.graphql-let.yml is for per-document, which imports the shared types
automatically. If you specify `typescript` as a plugin in .graphql-let, it's
still okay, but you can imagine it's redundant.

### No `generates`

codegen.yml has an option `generates`, but it's strictly controlled under
graphql-let. Rather, think graphql-let as a tool to let you forget intermediate
outputs and import/call GraphQL directly.

Therefore, we don't support output-file level configuration such as
[Output-file level schema](https://graphql-code-generator.com/docs/getting-started/schema-field#output-file-level),
[Output-file level documents](https://graphql-code-generator.com/docs/getting-started/documents-field#output-file-level),
and
[Output Level config](https://graphql-code-generator.com/docs/getting-started/config-field#output-level)
right now. But this could be changed logically, so please
[vote by issuing](https://github.com/piglovesyou/graphql-let/issues) if you'd
like.

### No `preset`

[Presets](https://www.graphql-code-generator.com/docs/presets/presets-index)
decide how to split/import each other, which graphql-let manages basically.
graphql-let generates per-document `.d.ts` and binds up schema types into a
shared file, that's why
[`@graphql-codegen/import-types-preset`](https://www.graphql-code-generator.com/docs/presets/import-types)
is our peer dependency.

I think you don't need to configure Presets, because graphql-let takes care of
what Presets does on your behalf. If you notice the use-case you need more
flexibility, please issue it.

### Limitation: `documents` expects `string | string[]`

Document-level options such as `noRequir` or
[Custom Document Loader](https://graphql-code-generator.com/docs/getting-started/documents-field#custom-document-loader)
are not supported.

### graphql-let specific options

In addition to `codegen.yml` options, graphql-let accepts these.

```yaml
# "plugins", required. The plugins for GraphQL documents to run GraphQL code
# generator with. You should omit `typescript` plugin which graphql-let generates internally.
# See here for more information. https://graphql-code-generator.com/docs/plugins/index
# Example:
plugins:
    - typescript-operations
    - typescript-react-apollo
    - add: "/* eslint-disable */"

# "respectGitIgnore", optional. `true` by default.
# If true, graphql-let will ignore files in .gitignore.
# Useful to prevent parsing files in such as `node_modules`.
respectGitIgnore: true

# "cacheDir", optional. `node_modules/.cache/graphql-let` by default.
# graphql-let takes care of intermediate `.ts(x)`s that GraphQL code generator
# generates, but we still need to write them on the disk for caching and
# TypeScript API purposes. This is the directory we store them to.
# Examples:
cacheDir: node_modules/.cache/graphql-let
cacheDir: .cache

# "TSConfigFile", optional. `tsconfig.json` by default.
# You can specify a custom config for generating `.d.ts`s.
# Examples:
TSConfigFile: tsconfig.json
TSConfigFile: tsconfig.compile.json

# "typeInjectEntrypoint", optional.
# `node_modules/@types/graphql-let/index.d.ts` by default. Needs to end with ".d.ts".
# Used as an entrypoint and directory of generated type declarations
# for `gql()` and `load()` calls.
typeInjectEntrypoint: node_modules/@types/graphql-let/index.d.ts

# "schemaEntrypoint", optional. You need this only if you want to use Resolver Types.
# Since you could point to multiple schemas, this path is
# used to generate `.d.ts` to generate `*.graphqls.d.ts`. If you do this,
#
#   schema: **/*.graphqls
#   schemaEntrypoint: schema.graphqls
#
# you can import the generated resolver types like below.
#
#   import { Resolvers } from '../schema.graphqls'
#
# It doesn't matter if the file of the path exists. I recommend
# you to specify a normal relative path without glob symbols (`**`) like this.
schemaEntrypoint: schema.graphqls
schemaEntrypoint: lib/schema.graphqls

# "silent", optional. `false` by default.
# Pass `true` if you want to suppress all standard output from graphql-let.
silent: false
```

Simple example:

```yaml
schema: "schema/**/*.graphqls"
documents:
    - "**/*.graphql"
    - "!shouldBeIgnored1"
plugins:
    - typescript-operations
    - typescript-react-apollo
```

Example with a bit more complicated options:

```yaml
schema:
    - https://api.github.com/graphql:
          headers:
              Authorization: YOUR-TOKEN-HERE
documents:
    - "**/*.graphql"
    - "!shouldBeIgnored1"
plugins:
    - typescript-operations
    - typescript-react-apollo
respectGitIgnore: true
config:
    reactApolloVersion: 3
    apolloReactComponentsImportFrom: "@apollo/client/react/components"
    useIndexSignature: true
cacheDir: .cache
TSConfigFile: tsconfig.compile.json
typeInjectEntrypoint: typings/graphql-let.d.ts
```

### Limitations of `graphql-let/babel`

-   **Sadly**, type injection can't be done with TaggedTemplateExpression such
    as `` gql`query {}` ``. This is the limitation of TypeScript.
    [Please answer me if you have any ideas.](https://stackoverflow.com/questions/61917066/can-taggedtempalte-have-overload-signatures-with-a-certain-string-literal-argume)
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
schema. Just use what you need; it's most likely to be `jest-transform-graphql`.

```diff
  module.exports = {
    transform: {
      "\\.graphql$": "graphql-let/jestTransformer",
+     "\\.graphqls$": "jest-transform-graphql",
    },
  };
```

## Experimental feature: Resolver Types

If you meet the following conditions, graphql-let generates Resolver Types.

-   You have `schemaEntrypoint` in the config
-   You have file paths including glob patterns in `schema`
-   You have
    [`@graphql-codegen/typescript-resolvers`](https://graphql-code-generator.com/docs/plugins/typescript-resolvers)
    installed
-   your `schemaEntrypoint` in .graphql-let.yml points to a single local GraphQL
    schema file (`.graphqls`)

Run:

```bash
yarn add -D @graphql-codegen/typescript-resolvers

yarn graphql-let
```

Then you will get `${schemaEntrypoint}.d.ts`. Import the types from it.

```typescript
import { Resolvers } from "../schema.graphqls";

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

`graphql-let/schema/loader` is also available. It generates/updates
`graphql-let/__generated__/__types__.d.ts` but it doesn't transpile anything;
just passes the file content to the next webpack loader.

```diff
  // webpack.config.ts
  const config: Configuration = {
    module: {
      rules: [
+       {
+         test: /\.graphqls$/,
+         use: [
+           { loader: 'graphql-let/schema/loader' },
+         ]
+       }
      ]
    }
  }
```

## FAQ

#### So, it's just a graphql-codegen wrapper generating `d.ts`...?

_Yes._

#### Supported combination of tools? / Tools x + y don't work!

The above documentation should work basically, but some of the combinations may
require more effort. Please vote by creating issues.
[Sponsoring me](https://github.com/sponsors/piglovesyou) is another way to get
my attention🍩🍦👀

These are the states/tools for the syntaxes.

| states/tools for syntax                                                      | import GraphQL document as<br>`import './a.graphql';`                          | Inline GraphQL document as<br>`import {gql} from 'graphql-let';`<br>`` gql(`query {}` ); `` |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| generating `.d.ts`s by command `graphql-let`                                 | ✅                                                                             | ✅                                                                                          |
| importing GraphQL content from another as<br>`# import A from './a.graphql'` | ✅                                                                             | ✅                                                                                          |
| webpack loader `graphql-let/loader`                                          | ✅                                                                             | ✅                                                                                          |
| Babel Plugin `graphql-let/babel`                                             | ✅                                                                             | ✅                                                                                          |
| Jest Transformer `graphql-let/jestTransfomer`                                | ✅                                                                             | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)                        |
| Experimental: Resolver Types for<br>GraphQL schema                           | ✅ by<br>`import {Resolvers}`<br> `from 'graphql-let/__generated__/__types__'` | (I think we don't need this)                                                                |

#### Is this a tool only for React?

No. There are
[more plugins that also generates `.ts(x)`s from GraphQL documents](https://graphql-code-generator.com/docs/plugins/).

#### Can I use Tagged Template as `` gql`query News { baa }`; ``?

Sadly, you need `gql()` instead of `` gql` `  `` because of
[the limitation of TypeScript](https://github.com/microsoft/TypeScript/issues/33304).

#### What's the extensions `.graphql` and `.graphqls`? Can I use `.gql` or something else?

You can use what you want. I wanted to recommend distinguishing GraphQL schema
and GraphQL documents in the extensions, which will lead to a more
understandable configuration for webpack loaders with fewer pitfalls. Another
reason for `.graphqls` is that it's one of
[the supported extensions in the internal library](https://github.com/ardatan/graphql-toolkit/blob/d29e518a655c02e3e14377c8c7d3de61f08e6200/packages/loaders/graphql-file/src/index.ts#L9).

#### How to integrate Apollo refetchQueries?

[Query document exports `DocumentNode` named `${QueryName}Document` that you can make use of.](https://github.com/piglovesyou/graphql-let/issues/66#issuecomment-596276493)

#### How to import `.graphql` from another document, especially GraphQL Fragment?

Thanks to
[`graphql-tools/import`](https://www.graphql-tools.com/docs/schema-loading/#using-import-expression),
the syntax `# import X from './fragment.graphql'` is supported.

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

#### `.tsx`es generated in `cacheDir` (`.cache`) throw TypeScript errors of wrong import paths

It's not a bug. Please exclude `cacheDir` from your TypeScript compilation. The files in `cacheDir` are only intermediates, which will speed your next execution.

```
Your GraphQL documents -> (call GraphQL code generator API *1) -> .tsx *2 -> (call TypeScript to distribute declarations *3) -> .d.ts
```

You're seeing the `*2`. It's used to skip `*1` and `*3`, and recodnized as generated implementations, which graphql-let/loader returns, for example.

## Contribution

-   **[Create an issue](https://github.com/piglovesyou/graphql-let/issues/new)**
    if you have ideas, find a bug, or anything.
-   **Creating a PR** is always welcome!
    -   Running `npm run prepublishOnly` locally will get your local development
        ready.
    -   Adding tests is preferable, but don't worry. Maybe someone else will
        fill it.

## License

MIT

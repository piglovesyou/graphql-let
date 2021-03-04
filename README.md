# graphql-let [![](https://github.com/piglovesyou/graphql-let/workflows/Node%20CI/badge.svg)](https://github.com/piglovesyou/graphql-let/actions) [![npm version](https://badgen.net/npm/v/graphql-let)](https://www.npmjs.com/package/graphql-let) [![downloads](https://badgen.net/npm/dm/graphql-let)](https://www.npmjs.com/package/graphql-let) [![Babel Macro](https://img.shields.io/badge/babel--macro-%F0%9F%8E%A3-f5da55.svg?style=flat-square)](https://github.com/kentcdodds/babel-plugin-macros)

A layer making you feel closer to GraphQL code generator.

Try
[the Next.js example](https://github.com/zeit/next.js/blob/canary/examples/with-typescript-graphql/README.md#readme)
that integrates graphql-let.

## Table of Contents

*   [Why this exists](#why-this-exists)
*   [Supported entrypoints and features](#supported-entrypoints-and-features)
*   [Get started with webpack loader](#get-started-with-webpack-loader)
*   [Configuration is compatible with `codegen.yml`, except:](#configuration-is-compatible-with-codegenyml-except)
*   [Setup Babel Plugin for inline GraphQL documents](#setup-babel-plugin-for-inline-graphql-documents)
*   [Jest Transformer](#jest-transformer)
*   [Experimental feature: Resolver Types](#experimental-feature-resolver-types)
*   [FAQ](#faq)
*   [Contribution](#contribution)
*   [License](#license)

## Why this exists

One of the strengths of GraphQL is
[enforcing data types on runtime](https://graphql.github.io/graphql-spec/June2018/#sec-Value-Completion).
Further, TypeScript and
[GraphQL code generator](https://graphql-code-generator.com/)
helps it even safer to type your codebase statically. Both makes a truly type-protected
development environment with rich IDE assists.

graphql-let enhances that development pattern by minimizing configuration setup, introducing intuitive syntax and confortable development experience through HMR (hot module
replacement).

```typescript jsx
import { useNewsQuery } from './news.graphql'

const News: React.FC = () => {
    // Typed already️⚡️
    const { data: { news } } = useNewsQuery()
    if (news) return <div>{news.map(...)}</div>
}
```

## Supported entrypoints and features

There are four entry points to start graphql-let:

*   **CLI**, assumed to run before type checking
*   webpack loader
*   babel-plugin-macros
*   Babel plugin

Mostly, all of them do the same as below.

1.  It loads configurations from `.graphql-let.yml`
2.  It finds GraphQL documents (queries, mutations, subscriptions) from `config.documents` including `*.graphql` and `*.ts(x)`.
3.  It passes the arguments to GraphQL code generator to generate `.ts(x)`. This is used for runtime.
4.  It also generates the corresponding `.d.ts` for the codegen results. This is used for static typing.

But there are a few differences between the entrypoints.

<table>
	<tr>
		<th align="left">Entry pointsYou need .graphql-let.yml and:</th>
		<th>Getting codegen result from</th>
		<th>Use values of codegen result</th>
		<th>Use types of codegen result</th>
		<th>Pros/Cons</th>
	</tr>
	<tr>
		<th rowspan="2" align="left">webpack loader<br /><br />Configure <code>"graphql-let/loader"</code><br /> to files <code>"/.*\.(tsx?|graphql)$/"</code> in webpack.config.(js|ts)</td>
		<td>File</td>
		<td colspan="2">✅ Import both value and types from a GraphQL document as a module.<br /><br /><pre>import {useQuery, Query} from "./a.graphql"</pre></td>
		<td rowspan="2">HMR works as expected.<br /><br />Webpack config is required even though your project only uses Babel</td>
	</tr>
	<tr>
		<td>String literal</td>
		<td>✅ by<br /><br /><pre>import {gql} from "graphql-let" <br />const {useQuery} = gql(`query A { braa }`)</pre></td>
		<td>⚠️You can, but you have to find the internal d.ts.<br /><br />import {gql} from "graphql-let"import {Query} from 'graphql-let/__generated__/index-A'const {useQuery} = gql(`query { braa }`)</td>
	</tr>
	<tr>
		<th rowspan="2" align="left">babel-plugin-macros<br /><br />If you've already setupbabel-plugin-macros,no config needed any more</td>
		<td>File</td>
		<td>✅ by<br /><br />import {loader} from "graphql-let/macro"const {useQuery} = load("./a.graphql")</td>
		<td>⚠️You can, but you have to find the internally generated d.ts.<br /><br />import {loader} from "graphql-let/macro"import {Query} from 'graphql-let/__generated__/index-A'const {useQuery} = load("./a.graphql")</td>
		<td rowspan="2">Easiest to integrate if your project already has babel-plugin-macros. create-react-app is the great fit.Cannot load types from function call.<br /><br />Modifying *.graphql doesn't emit HMR.</td>
	</tr>
	<tr>
		<td>String literal</td>
		<td>✅ by<br /><br />import {gql} from "graphql-let/macro"const {useQuery} = gql(`query A { braa }`)</td>
		<td>⚠️You can, but you have to find the internally generated d.ts.<br /><br />import {gql} from "graphql-let/macro"import {Query} from 'graphql-let/__generated__/index-A'const {useQuery} = gql(`query { braa }`)</td>
	</tr>
	<tr>
		<th rowspan="2" align="left">babel-plugin<br /><br />Put "graphql-let/babel"to you .babelrc as a plugin</td>
		<td>File</td>
		<td>✅ by<br /><br />import {loader} from "graphql-let"const {useQuery} = load("./a.graphql")</td>
		<td>⚠️You can, but you have to find the internally generated d.ts.<br /><br />import {loader} from "graphql-let"import {Query} from 'graphql-let/__generated__/index-A'const {useQuery} = load("./a.graphql")</td>
		<td rowspan="2">Mostly equivalent to babel-plugin-macros, but you always need your .babelrc configuration. Possibly, `import "./a.graphql"` could be implemented, but not supported yet.Cannot load types from function call.<br /><br />Modifying *.graphql doesn't emit HMR.Possibly I can make "--watch" option butlots to do for dependency management to detect file change.</td>
	</tr>
	<tr>
		<td>String literal</td>
		<td>✅ by<br /><br />import {gql} from "graphql-let"const {useQuery} = gql(`query A { braa }`)</td>
		<td>⚠️You can, but you have to find the internally generated d.ts.<br /><br />import {gql} from "graphql-let"import {Query} from 'graphql-let/__generated__/index-A'const {useQuery} = gql(`query { braa }`)</td>
	</tr>
</table>


<details>
  <summary>Efficient?</summary>

There are things to make graphql-let light and stable.

*   Sharing the processes. Generating files is expensive, so it runs less time
    to run GraphQL code generator and TypeScript API.
*   Caching. By embedding hashes as your source states, it reduces the number of
    unnecessary processing.
*   Sharing the promises. The webpack compilation in typical SSR applications as
    Next.js runs [targets](https://webpack.js.org/concepts/targets/) of `"node"`
    and `"web"` simultaneously. If sources are the same, the compilation should be once.

</details>

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

## Configuration is compatible with `codegen.yml`, except:

graphql-let passes most of the options to GraphQL code generator, so
**`.graphql-let.yml` is mostly compatible with `codegen.yml`. However**, there
are differences you should know. In short, the below diff is the quick migration
guide.

```diff
 schema: https://api.github.com/graphql
 documents: "**/*.graphql"
-generates:
-    ./__generated__/types.ts:
-        plugins:
-            - typescript
-            - typescript-operations
+plugins:
+    - typescript
+    - typescript-operations
```

### Exception: `generates`

`generates` is strictly controlled under graphql-let. Rather, think graphql-let
as a tool to let you forget intermediate outputs and import/call GraphQL
directly.

Therefore, we don't support output-file level configuration such as
[Output-file level schema](https://graphql-code-generator.com/docs/getting-started/schema-field#output-file-level),
[Output-file level documents](https://graphql-code-generator.com/docs/getting-started/documents-field#output-file-level)
and
[Output Level config](https://graphql-code-generator.com/docs/getting-started/config-field#output-level)
right now. But this could be changed logically, so, please
[vote by issuing](https://github.com/piglovesyou/graphql-let/issues) if you'd
like.

### Limitation: `documents` expects only `string | string[]`

Documen-pointer level options such as `noRequire: true` or
[Custom Document Loader](https://graphql-code-generator.com/docs/getting-started/documents-field#custom-document-loader)
are not supported.

### Babel Plugin Limitation: ``gql(`query{}`)`` is allowed only in `.ts(x)`s

Currently, ``gql(`query{}`)`` can be handled only for files with extensions
`.ts` and `.tsx`.

graphql-tag-pluck, which GraphQL code generator uses under the hood, plucks
GraphQL documents/schema from sources such as `.flow` and `.vue`. graphql-let
doesn't use it since it focuses on plucking and graphql-let has to modify each
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

# "gqlDtsEntrypoint", optional.
# `node_modules/@types/graphql-let/index.d.ts` by default. Needs to end with ".d.ts".
# Used as an entrypoint and directory of generated type declarations for `gql()` calls.
gqlDtsEntrypoint: node_modules/@types/graphql-let/index.d.ts

# "schemaEntrypoint", optional. You need this if you want to use Resolver Types.
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
```

Simple example:

```yaml
schema: "schema/**/*.graphqls"
documents:
    - "**/*.graphql"
    - "!shouldBeIgnored1"
plugins:
    - typescript
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
    - typescript
    - typescript-operations
    - typescript-react-apollo
respectGitIgnore: true
config:
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

*   **Sadly**, type injection can't be done with TaggedTemplateExpression such
    as `` gql`query {}` ``. This is the limitation of TypeScript.
    [Please answer me if you have ideas.](https://stackoverflow.com/questions/61917066/can-taggedtempalte-have-overload-signatures-with-a-certain-string-literal-argume)
*   Fragments are still not available. Please watch
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

If you meet the following conditions, graphql-let generates Resolver Types.

*   You have `schemaEntrypoint` in the config
*   You have file paths including glob patterns in `schema`
*   You have
    [`@graphql-codegen/typescript-resolvers`](https://graphql-code-generator.com/docs/plugins/typescript-resolvers)
    installed
*   your `schemaEntrypoint` in .graphql-let.yml points to a single local GraphQL
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
`${schemaEntrypoint}.d.ts` but it doesn't transpile anything; just passes the
file content to the next webpack loader. Set it up as below:

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

*Yes.*

#### Supported combination of tools? / x + y don't work!

Basically both syntax `import './a.graphql'` and ``gql(`query {}` )`` are
suposed to just work, but currently some of combinations require more effort.
Please vote by creating issues.
[Sponsering me](https://github.com/sponsors/piglovesyou) is another way to get
my attention🍩🍦

These are the states/tools for the syntaxes.

| states/tools for syntax                                                      | File import as<br>`import './a.graphql';`                            | Inline GraphQL as<br>`import gql from 'graphql-tag';`<br>``gql(`query {}` );`` |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| generating `.d.ts`s by command `graphql-let`                                 | ✅                                                                   | ✅                                                                               |
| importing GraphQL content from another as<br>`# import A from './a.graphql'` | ✅                                                                   | ✅                                                                               |
| webpack loader `graphql-let/loader`                                          | ✅                                                                   | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |
| Babel Plugin `graphql-let/babel`                                             | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues) | ✅                                                                               |
| Jest Transformer `graphql-let/jestTransfomer`                                | ✅                                                                   | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |
| Experimental: Resolver Types for<br>GraphQL schema                           | ✅ by<br>`import './schema.graphqls'`                                | [Vote by issuing](https://github.com/piglovesyou/graphql-let/issues)             |

#### Is this a tool only for React?

No. There are
[more plugins that also generates `.ts(x)`s from GraphQL documents](https://graphql-code-generator.com/docs/plugins/).

#### Can I write GraphQL documents in my `.tsx` as ``const query = gql`query News{ ... }`;``?

Please try the Babel Plugin `graphql-let/babel`, but you need parenthesis
``gql(`query {}`)``.

#### What's the extension `.graphqls`? Should I use it for schema and `.graphql` for documents?

Not exactly, but I'd recommend them. I think using different extensions for
schema/documents leads to a more understandable configuration for webpack
loaders with fewer pitfalls. Another reason for `.graphqls` is that it's one of
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

## Contribution

*   **[Create an issue](https://github.com/piglovesyou/graphql-let/issues/new)**
    if you have ideas, found a bug or anything.
*   **Creating a PR** is always welcome!
    *   Running `npm run prepublishOnly` locally will get your local development
        ready.
    *   Adding tests is preferable, but don't hesitate without it, maybe someone
        else will fill it.

## License

MIT

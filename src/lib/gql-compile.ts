import { generate } from '@graphql-codegen/cli';
// import { Types } from "@graphql-codegen/plugin-helpers";
import traverse, { NodePath } from '@babel/traverse';
import makeDir from 'make-dir';
import { join as pathJoin, extname, basename, dirname } from 'path';
import { existsSync } from 'fs';
import { genDts } from './dts';
import { rimraf } from './file';
import mkdirp from 'mkdirp';
// TODO
import { createWriteStream } from 'fs';
import { stripIgnoredCharacters } from 'graphql';
import { parse, ParserOptions } from '@babel/parser';
import { readFile } from './file';
import { join } from 'path';
// import createCodegenOpts from "../../src/lib/create-codegen-opts";
import { writeFile } from './file';
import { createHash } from './hash';
import memoize from './memoize';
// import loadConfig from "../../src/lib/load-config";
import { ConfigTypes } from './types';
import * as t from '@babel/types';

const packageJsonContent = JSON.stringify({ types: 'index' }, null, 2);

export type GqlCodegenContext = {
  gqlContent: string;
  strippedGqlContent: string;
  gqlContentHash: string;
  sourceRelPath: string;
  sourceFullPath: string;
  tsxRelPath: string;
  tsxFullPath: string;
  dtsRelPath: string;
  dtsFullPath: string;
}[];

type CacheState = {
  [hash: string]: string;
};

type CacheStateStore = {
  [tsxRelPath: string]: CacheState;
};

const getPaths = (
  sourceRelPath: string,
  hash: string,
  dtsRelDir: string,
  cacheRelDir: string,
  cwd: string,
) => {
  const abs = (relPath: string) => pathJoin(cwd, relPath);

  const tsxGenFullDir = abs(cacheRelDir);
  const dtsGenFullDir = abs(dtsRelDir);
  // sourceRelPath: "pages/index.tsx"
  // "pages"
  const relDir = dirname(sourceRelPath);
  // ".tsx"
  const ext = extname(sourceRelPath);
  // "${cwd}/pages/index.tsx"
  const sourceFullPath = abs(sourceRelPath);
  // "index"
  const base = basename(sourceRelPath, ext);

  // "index-2345.tsx"
  const tsxBasename = `${base}-${hash}${ext}`;
  // "pages/index-2345.tsx"
  const tsxRelPath = pathJoin(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = pathJoin(tsxGenFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${hash}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = pathJoin(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = pathJoin(dtsGenFullDir, dtsRelPath);
  // TODO
  return {
    sourceRelPath,
    sourceFullPath,
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
  };
};
const parserOption: ParserOptions = {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
};

import generator from '@babel/generator';

function appendExportAsObject(dtsContent: string) {
  // TODO: Build ast
  // TODO: "declare" needed?
  let allExportsCode = `export declare type __AllExports = { `;
  const visitors: any = {
    TSDeclareFunction({
      node: {
        id: { name },
      },
    }: any) {
      allExportsCode += `${name}: typeof ${name},`;
    },
  };
  visitors.VariableDeclarator = visitors.TSTypeAliasDeclaration = function pushProps({
    node: {
      id: { name },
    },
  }: any) {
    allExportsCode += `${name}: ${name},`;
  };

  const dtsAST = parse(dtsContent, parserOption);
  traverse(dtsAST, {
    ExportNamedDeclaration(path: any) {
      path.traverse(visitors);
    },
    Program: {
      exit(path: NodePath<t.Program>) {
        allExportsCode += '};';
        // TODO: refactor
        traverse(parse(allExportsCode, parserOption), {
          ExportNamedDeclaration({ node }) {
            const body = path.get('body');
            body[body.length - 1].insertAfter(node);
          },
        });
      },
    },
  });

  const { code } = generator(dtsAST);
  return code;
}

export async function processGqlCompile(
  cwd: string,
  config: ConfigTypes,
  dtsRelDir: string,
  cacheRelDir: string,
  sourceRelPath: string,
  schemaHash: string,
  gqlContents: string[],
  targetStore: CacheState,
  codegenContext: GqlCodegenContext,
  // skippedContext: GqlCodegenContext,
  oldGqlContentHashes: Set<string>,
) {
  /**
   * 0. Shape of storage
   * {
   *   "userRelPath.tsx": {
   *     "gqlContentHash1": "query{\n}",
   *     "gqlContentHash2": "query{\n}",
   *   }
   * }
   * 1. take care all multiple gql() in file. Check gqlContentHash and generate if not exists.
   * 2. All done. remove all old dts.
   * 3. Store the latest dts paths.
   * 4. Print index.d.ts from the entire storage
   *
   * 5. Write .tsx to cacheDir
   * 6. Import it from babel target by inserting a "import" line
   *
   * 7. Done.
   */
  const newGqlCodegenContext: GqlCodegenContext = [];

  for (const gqlContent of gqlContents) {
    const strippedGqlContent = stripIgnoredCharacters(gqlContent);
    const gqlContentHash = createHash(schemaHash + strippedGqlContent);
    const context = {
      gqlContent,
      strippedGqlContent,
      gqlContentHash,
      ...getPaths(sourceRelPath, gqlContentHash, dtsRelDir, cacheRelDir, cwd),
    };
    if (!targetStore[gqlContentHash]) {
      newGqlCodegenContext.push(context);
    }
    // Push all for later use
    codegenContext.push(context);
    // Old caches left will be removed
    oldGqlContentHashes.delete(gqlContentHash);
  }

  if (!newGqlCodegenContext.length) return;

  // Codegen
  for (const { strippedGqlContent, tsxFullPath } of newGqlCodegenContext) {
    const [{ content }] = await generate(
      {
        silent: true, // Necessary to pass stdout to the parent process
        cwd,
        schema: config.schema,
        documents: [strippedGqlContent],
        generates: {
          [tsxFullPath]: {
            plugins: config.plugins,
            config: config.config,
          },
        },
      },
      false,
    );
    await mkdirp(dirname(tsxFullPath));
    await writeFile(tsxFullPath, content);
  }

  // Dts only for newly created `.tsx`s
  const dtsContents = genDts(
    newGqlCodegenContext.map(({ tsxFullPath }) => tsxFullPath),
    config,
  );
  await makeDir(dirname(newGqlCodegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const {
      dtsFullPath,
      strippedGqlContent,
      gqlContentHash,
    } = newGqlCodegenContext[i]!;
    targetStore[gqlContentHash] = strippedGqlContent;
    const content = appendExportAsObject(dtsContent);
    await writeFile(dtsFullPath, content);
  }
}

export type GqlCompileArgs = {
  cwd: string;
  dtsRelDir: string;
  cacheRelDir: string;
  sourceRelPath: string;
  schemaHash: string;
  gqlContents: string[];
  config: ConfigTypes;
};

// It's still troublesome even it's babel-plugin in SSR applicaiton like Next.js
// where multiple webpack transpile handles a single source file.
const memoizedProcessGqlCompile = memoize(
  processGqlCompile,
  (_cwd, _config, _dtsRelDir, _cacheRelDir, sourceRelPath) => sourceRelPath,
);

export async function gqlCompile(
  gqlCompileArgs: GqlCompileArgs,
): Promise<GqlCodegenContext> {
  const {
    cwd,
    config,
    dtsRelDir,
    cacheRelDir,
    sourceRelPath,
    schemaHash,
    gqlContents,
  } = gqlCompileArgs;
  const codegenContext: GqlCodegenContext = [];
  // const skippedContext: GqlCodegenContext = [];

  // Processes inside a sub-process of babel-plugin
  const storeFullPath = pathJoin(cwd, dtsRelDir, 'store.json');
  const store = existsSync(storeFullPath)
    ? JSON.parse(await readFile(storeFullPath, 'utf-8'))
    : {};
  const targetStore = store[sourceRelPath] || (store[sourceRelPath] = {});
  const oldGqlContentHashes = new Set(Object.keys(targetStore));

  // Prepare
  await Promise.all([
    await mkdirp(join(cwd, dtsRelDir)),
    await mkdirp(join(cwd, cacheRelDir)),
  ]);
  // TODO: Need this? I think I don't
  // await writeFile(join(cwd, dtsRelDir, "package.json"), packageJsonContent);

  await memoizedProcessGqlCompile(
    cwd,
    config,
    dtsRelDir,
    cacheRelDir,
    sourceRelPath,
    schemaHash,
    gqlContents,
    targetStore,
    codegenContext,
    // skippedContext,
    oldGqlContentHashes,
  );

  // Remove old caches
  for (const oldGqlContentHash of oldGqlContentHashes) {
    delete targetStore[oldGqlContentHash];
    const { dtsFullPath } = getPaths(
      sourceRelPath,
      oldGqlContentHash,
      dtsRelDir,
      cacheRelDir,
      cwd,
    );
    if (existsSync(dtsFullPath)) {
      await rimraf(dtsFullPath);
    }
  }

  // Update index.d.ts
  const dtsEntryFullPath = pathJoin(cwd, dtsRelDir, 'index.d.ts');
  const writeStream = createWriteStream(dtsEntryFullPath);
  for (const { gqlContent, gqlContentHash, dtsRelPath } of codegenContext) {
    const chunk = `import T${gqlContentHash} from './${dtsRelPath}';
export default function gql(gql: \`${gqlContent}\`): T${gqlContentHash}.__AllExports;
`;
    await new Promise((resolve) => writeStream.write(chunk, resolve));
  }

  // Update storeJson
  await writeFile(storeFullPath, JSON.stringify(store, null, 2));

  return codegenContext;
}

export function timeout(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ yeah: 'yeah ohhhh xxxx' });
    }, ms);
  });
}

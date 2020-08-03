import { generate } from '@graphql-codegen/cli';
import traverse, { NodePath } from '@babel/traverse';
import makeDir from 'make-dir';
import { join as pathJoin, extname, basename, dirname, relative } from 'path';
import { existsSync } from 'fs';
import slash from 'slash';
import { genDts } from './dts';
import { ExecContext } from './exec-context';
import { rimraf } from './file';
import { createWriteStream } from 'fs';
import { stripIgnoredCharacters } from 'graphql';
import { parse, ParserOptions } from '@babel/parser';
import { readFile } from './file';
import { join } from 'path';
import { writeFile } from './file';
import { createHash } from './hash';
import memoize from './memoize';
import * as t from '@babel/types';

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
};

type ScopedCacheStore = {
  [hash: string]: string;
};

type ProjectCacheStore = {
  [tsxRelPath: string]: ScopedCacheStore;
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
export const parserOption: ParserOptions = {
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
  execContext: ExecContext,
  dtsRelDir: string,
  cacheRelDir: string,
  sourceRelPath: string,
  schemaHash: string,
  gqlContents: string[],
  targetStore: ScopedCacheStore,
  codegenContext: GqlCodegenContext[],
  // skippedContext: GqlCodegenContext,
  oldGqlContentHashes: Set<string>,
) {
  const { cwd, config } = execContext;

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
  const newGqlCodegenContext: GqlCodegenContext[] = [];

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
            config: execContext.codegenOpts.config,
          },
        },
      },
      false,
    );
    await makeDir(dirname(tsxFullPath));
    await writeFile(tsxFullPath, content);
  }

  // Dts only for newly created `.tsx`s
  const dtsContents = genDts(
    execContext,
    newGqlCodegenContext.map(({ tsxFullPath }) => tsxFullPath),
    // config,
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
  execContext: ExecContext;
  schemaHash: string;
  sourceRelPath: string;
  gqlContents: string[];
};

// It's still troublesome even it's babel-plugin in SSR applicaiton like Next.js
// where multiple webpack transpile handles a single source file.
const memoizedProcessGqlCompile = memoize(
  processGqlCompile,
  (_cwd, _config, _dtsRelDir, _cacheRelDir, sourceRelPath) => sourceRelPath,
);

export async function gqlCompile(
  gqlCompileArgs: GqlCompileArgs,
): Promise<GqlCodegenContext[]> {
  const {
    execContext,
    sourceRelPath,
    schemaHash,
    gqlContents,
  } = gqlCompileArgs;
  const { cwd, config, cacheFullDir } = execContext;

  // TODO: do this in getPaths
  const cacheRelDir = relative(cwd, cacheFullDir); // Want this?

  const dtsRelDir = dirname(config.gqlDtsEntrypoint);
  const codegenContext: GqlCodegenContext[] = [];

  // Processes inside a sub-process of babel-plugin
  const storeFullPath = pathJoin(cwd, dtsRelDir, 'store.json');
  const projectStore: ProjectCacheStore = existsSync(storeFullPath)
    ? JSON.parse(await readFile(storeFullPath, 'utf-8'))
    : {};
  const scopedStore =
    projectStore[sourceRelPath] || (projectStore[sourceRelPath] = {});
  const oldGqlContentHashes = new Set(Object.keys(scopedStore));

  // Prepare
  await Promise.all([
    await makeDir(join(cwd, dtsRelDir)),
    await makeDir(join(cwd, cacheRelDir)),
  ]);

  await memoizedProcessGqlCompile(
    execContext,
    dtsRelDir,
    cacheRelDir,
    sourceRelPath,
    schemaHash,
    gqlContents,
    scopedStore,
    codegenContext,
    oldGqlContentHashes,
  );

  // Remove old caches
  for (const oldGqlContentHash of oldGqlContentHashes) {
    delete scopedStore[oldGqlContentHash];
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
  const dtsEntryFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
  const writeStream = createWriteStream(dtsEntryFullPath);
  for (const { gqlContent, gqlContentHash, dtsRelPath } of codegenContext) {
    const chunk = `import T${gqlContentHash} from './${slash(dtsRelPath)}';
export default function gql(gql: \`${gqlContent}\`): T${gqlContentHash}.__AllExports;
`;
    await new Promise((resolve) => writeStream.write(chunk, resolve));
  }

  // Update storeJson
  await writeFile(storeFullPath, JSON.stringify(projectStore, null, 2));

  return codegenContext;
}

import { generate } from '@graphql-codegen/cli';
import traverse, { NodePath } from '@babel/traverse';
import makeDir from 'make-dir';
import { join as pathJoin, extname, basename, dirname } from 'path';
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
import generator from '@babel/generator';
import { SrcCodegenContext, SrcCreatedPaths } from './types';

type ScopedCacheStore = {
  [hash: string]: string;
};

type ProjectCacheStore = {
  [tsxRelPath: string]: ScopedCacheStore;
};

const createPaths = (
  srcRelPath: string,
  hash: string,
  dtsRelDir: string,
  cacheFullDir: string,
  cwd: string,
): SrcCreatedPaths => {
  const abs = (relPath: string) => pathJoin(cwd, relPath);

  const dtsGenFullDir = abs(dtsRelDir);
  // srcRelPath: "pages/index.tsx"
  // "pages"
  const relDir = dirname(srcRelPath);
  // ".tsx"
  const ext = extname(srcRelPath);
  // "${cwd}/pages/index.tsx"
  const srcFullPath = abs(srcRelPath);
  // "index"
  const base = basename(srcRelPath, ext);

  // "index-2345.tsx"
  const tsxBasename = `${base}-${hash}${ext}`;
  // "pages/index-2345.tsx"
  const tsxRelPath = pathJoin(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = pathJoin(cacheFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${hash}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = pathJoin(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = pathJoin(dtsGenFullDir, dtsRelPath);
  // TODO
  return {
    srcRelPath,
    srcFullPath,
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

async function generateTsx(
  execContext: ExecContext,
  newGqlCodegenContext: SrcCodegenContext[],
) {
  const { cwd, config } = execContext;

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
}

async function generateDts(
  execContext: ExecContext,
  newGqlCodegenContext: SrcCodegenContext[],
  targetStore: ScopedCacheStore,
) {
  // Dts only for newly created `.tsx`s
  const dtsContents = genDts(
    execContext,
    newGqlCodegenContext.map(({ tsxFullPath }) => tsxFullPath),
  );
  await makeDir(dirname(newGqlCodegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath, strippedGqlContent, gqlHash } = newGqlCodegenContext[
      i
    ]!;
    const content = appendExportAsObject(dtsContent);
    await writeFile(dtsFullPath, content);
  }
}

export async function processGqlCompile(
  execContext: ExecContext,
  sourceRelPath: string,
  schemaHash: string,
  gqlContents: string[],
  // scopedStore: ScopedCacheStore,
  codegenContext: SrcCodegenContext[],
  // oldGqlHashes: Set<string>,
) {
  const { cwd, config, cacheFullDir } = execContext;
  const dtsRelDir = dirname(config.gqlDtsEntrypoint);

  // Processes inside a sub-process of babel-plugin
  const storeFullPath = pathJoin(cwd, dtsRelDir, 'store.json');
  const projectStore: ProjectCacheStore = existsSync(storeFullPath)
    ? JSON.parse(await readFile(storeFullPath, 'utf-8'))
    : {};
  const scopedStore =
    projectStore[sourceRelPath] || (projectStore[sourceRelPath] = {});
  const oldGqlHashes = new Set(Object.keys(scopedStore));

  // Prepare
  await Promise.all([
    await makeDir(join(cwd, dtsRelDir)),
    await makeDir(cacheFullDir),
  ]);

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
  const newGqlCodegenContext: SrcCodegenContext[] = [];

  for (const gqlContent of gqlContents) {
    const strippedGqlContent = stripIgnoredCharacters(gqlContent);
    const gqlHash = createHash(schemaHash + strippedGqlContent);
    const context = {
      ...createPaths(sourceRelPath, gqlHash, dtsRelDir, cacheFullDir, cwd),
      gqlContent,
      strippedGqlContent,
      gqlHash,
    };
    if (!scopedStore[gqlHash]) {
      newGqlCodegenContext.push(context);
      scopedStore[gqlHash] = strippedGqlContent;
    }
    // Push all for later use
    codegenContext.push(context);
    // Old caches left will be removed
    oldGqlHashes.delete(gqlHash);
  }

  if (!newGqlCodegenContext.length) return;

  await generateTsx(execContext, newGqlCodegenContext);

  await generateDts(execContext, newGqlCodegenContext, scopedStore);

  // Remove old caches
  for (const oldGqlHash of oldGqlHashes) {
    delete scopedStore[oldGqlHash];
    const { dtsFullPath } = createPaths(
      sourceRelPath,
      oldGqlHash,
      dtsRelDir,
      cacheFullDir,
      cwd,
    );
    if (existsSync(dtsFullPath)) {
      await rimraf(dtsFullPath);
    }
  }

  // Update index.d.ts
  const dtsEntryFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
  const writeStream = createWriteStream(dtsEntryFullPath);
  for (const { gqlContent, gqlHash, dtsRelPath } of codegenContext) {
    const chunk = `import T${gqlHash} from './${slash(dtsRelPath)}';
export default function gql(gql: \`${gqlContent}\`): T${gqlHash}.__AllExports;
`;
    await new Promise((resolve) => writeStream.write(chunk, resolve));
  }

  // Update storeJson
  await writeFile(storeFullPath, JSON.stringify(projectStore, null, 2));
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
  (_execContext, sourceRelPath) => sourceRelPath,
);

export async function gqlCompile(
  gqlCompileArgs: GqlCompileArgs,
): Promise<SrcCodegenContext[]> {
  const {
    execContext,
    sourceRelPath,
    schemaHash,
    gqlContents,
  } = gqlCompileArgs;

  const codegenContext: SrcCodegenContext[] = [];

  // const { cwd, config, cacheFullDir } = execContext;
  // const dtsRelDir = dirname(config.gqlDtsEntrypoint);

  // // Processes inside a sub-process of babel-plugin
  // const storeFullPath = pathJoin(cwd, dtsRelDir, 'store.json');
  // const projectStore: ProjectCacheStore = existsSync(storeFullPath)
  //   ? JSON.parse(await readFile(storeFullPath, 'utf-8'))
  //   : {};
  // const scopedStore =
  //   projectStore[sourceRelPath] || (projectStore[sourceRelPath] = {});
  // const oldGqlHashes = new Set(Object.keys(scopedStore));
  //
  // // Prepare
  // await Promise.all([
  //   await makeDir(join(cwd, dtsRelDir)),
  //   await makeDir(cacheFullDir),
  // ]);

  await memoizedProcessGqlCompile(
    execContext,
    // dtsRelDir,
    // cacheFullDir,
    sourceRelPath,
    schemaHash,
    gqlContents,
    codegenContext,
  );

  //   // Remove old caches
  //   for (const oldGqlHash of oldGqlHashes) {
  //     delete scopedStore[oldGqlHash];
  //     const { dtsFullPath } = createPaths(
  //       sourceRelPath,
  //       oldGqlHash,
  //       dtsRelDir,
  //       cacheFullDir,
  //       cwd,
  //     );
  //     if (existsSync(dtsFullPath)) {
  //       await rimraf(dtsFullPath);
  //     }
  //   }
  //
  //   // Update index.d.ts
  //   const dtsEntryFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
  //   const writeStream = createWriteStream(dtsEntryFullPath);
  //   for (const { gqlContent, gqlHash, dtsRelPath } of codegenContext) {
  //     const chunk = `import T${gqlHash} from './${slash(dtsRelPath)}';
  // export default function gql(gql: \`${gqlContent}\`): T${gqlHash}.__AllExports;
  // `;
  //     await new Promise((resolve) => writeStream.write(chunk, resolve));
  //   }
  //
  //   // Update storeJson
  //   await writeFile(storeFullPath, JSON.stringify(projectStore, null, 2));

  return codegenContext;
}

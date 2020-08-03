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
import * as t from '@babel/types';
import generator from '@babel/generator';
import {
  CodegenContext,
  isLiteralContext,
  LiteralCodegenContext,
  LiteralCreatedPaths,
} from './types';

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
): LiteralCreatedPaths => {
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
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;

  // Codegen
  for (const context of codegenContext) {
    if (!isLiteralContext(context)) return;
    const {
      strippedGqlContent,
      tsxFullPath,
    } = context as LiteralCodegenContext;
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
  codegenContext: LiteralCodegenContext[],
) {
  if (!codegenContext.length) return;

  // Dts only for newly created `.tsx`s
  const dtsContents = genDts(
    execContext,
    codegenContext.map(({ tsxFullPath }) => tsxFullPath),
  );

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath } = codegenContext[i]!;
    const content = appendExportAsObject(dtsContent);
    await writeFile(dtsFullPath, content);
  }
}

export async function processGql(
  execContext: ExecContext,
  sourceRelPath: string,
  schemaHash: string,
  gqlContents: string[],
  codegenContext: CodegenContext[],
): Promise<void> {
  const { cwd, config, cacheFullDir } = execContext;
  const dtsRelDir = dirname(config.gqlDtsEntrypoint);

  /**
   * Shape of storage
   *   {
   *     "userRelPath.tsx": {
   *       "gqlHash1": "query {}",
   *       "gqlHash2": "query {}",
   *     }
   *   }
   * 1. Prepare store if not exists.
   * 2. Get the current state of the target source `.tsx`.
   * 3. Check if caches of the gqlContents exist.
   *    If not, put it to codegenContext to create new.
   * 4. If we have obsolete caches, delete them.
   * 5. Finally,
   *    1. Update dtsEntryFullPath
   *    2. Update projectStore
   *
   * We don't do these here:
   *    1. Write tsx
   *    2. Write dts
   */

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

  for (const gqlContent of gqlContents) {
    const strippedGqlContent = stripIgnoredCharacters(gqlContent);
    const gqlHash = createHash(schemaHash + strippedGqlContent);

    scopedStore[gqlHash] = strippedGqlContent;

    codegenContext.push({
      ...createPaths(sourceRelPath, gqlHash, dtsRelDir, cacheFullDir, cwd),
      gqlContent,
      strippedGqlContent,
      gqlHash,
      skip: Boolean(scopedStore[gqlHash]),
      dtsContentDecorator: appendExportAsObject,
    });

    // Old caches left will be removed
    oldGqlHashes.delete(gqlHash);
  }

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
  for (const context of codegenContext) {
    if (!isLiteralContext(context)) continue;
    const {
      gqlContent,
      gqlHash,
      dtsRelPath,
    } = context as LiteralCodegenContext;
    const chunk = `import T${gqlHash} from './${slash(dtsRelPath)}';
export default function gql(gql: \`${gqlContent}\`): T${gqlHash}.__AllExports;
`;
    await new Promise((resolve) => writeStream.write(chunk, resolve));
  }

  // Update storeJson
  await writeFile(storeFullPath, JSON.stringify(projectStore, null, 2));

  await generateTsx(execContext, codegenContext);
}

export type GqlArgs = {
  execContext: ExecContext;
  schemaHash: string;
  sourceRelPath: string;
  gqlContents: string[];
};

export async function gqlInSubProcess(
  gqlArgs: GqlArgs,
): Promise<LiteralCodegenContext[]> {
  const { execContext, sourceRelPath, schemaHash, gqlContents } = gqlArgs;

  const codegenContext: LiteralCodegenContext[] = [];

  await processGql(
    execContext,
    sourceRelPath,
    schemaHash,
    gqlContents,
    codegenContext,
  );

  await generateDts(execContext, codegenContext);

  return codegenContext;
}

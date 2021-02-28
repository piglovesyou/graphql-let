import { processImport } from '@graphql-tools/import';
import { DocumentNode, OperationDefinitionNode, print } from 'graphql';
import { basename, dirname, extname, join as pathJoin } from 'path';
import { ExecContext } from '../lib/exec-context';
import { createHash, readHash } from '../lib/hash';

export const typesRootRelDir = '__generated__';

export function createTiPaths(
  execContext: ExecContext,
  srcRelPath: string,
  callIdentity: string,
) {
  const abs = (relPath: string) => pathJoin(cwd, relPath);
  const { cwd, config, cacheFullDir } = execContext;
  const gqlDtsEntrypointFullDir = pathJoin(
    cwd,
    dirname(config.gqlDtsEntrypoint),
  );

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
  const tsxBasename = `${base}-${callIdentity}${ext}`;
  // "pages/index-2345.tsx"
  const tsxRelPath = pathJoin(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = pathJoin(cacheFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${callIdentity}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = pathJoin(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = pathJoin(
    gqlDtsEntrypointFullDir,
    typesRootRelDir,
    dtsRelPath,
  );
  return {
    srcRelPath,
    srcFullPath,
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
  };
}

function resolveGraphQLDocument(
  importRootPath: string,
  gqlContent: string,
  cwd: string,
): DocumentNode {
  // This allows to start from content of GraphQL document, not file path
  const predefinedImports = { [importRootPath]: gqlContent };
  return processImport(importRootPath, cwd, predefinedImports);
}

export function prepareAppendTiContext(
  execContext: ExecContext,
  schemaHash: string,
  sourceRelPath: string,
  sourceFullPath: string,
  gqlContent: string,
  importRootPath: string,
) {
  const { cwd } = execContext;
  const documentNode = resolveGraphQLDocument(importRootPath, gqlContent, cwd);
  const resolvedGqlContent = print(documentNode);
  const documentName = documentNode.definitions
    .map((d) => (d as OperationDefinitionNode).name!.value)
    .join('-');
  const gqlHash = createHash(schemaHash + resolvedGqlContent);
  const createdPaths = createTiPaths(execContext, sourceRelPath, documentName);
  const { tsxFullPath, dtsFullPath } = createdPaths;
  const shouldUpdate =
    gqlHash !== readHash(tsxFullPath) || gqlHash !== readHash(dtsFullPath);
  return { gqlHash, createdPaths, shouldUpdate, resolvedGqlContent };
}

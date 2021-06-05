import { processImport, VisitedFilesMap } from '@graphql-tools/import';
import { OperationDefinitionNode, print } from 'graphql';
import { basename, dirname, extname, join } from 'path';
import { ExecContext } from '../lib/exec-context';
import { createHash, readHash } from '../lib/hash';

export const typesRootRelDir = '__generated__';

export function createTiPaths(
  execContext: ExecContext,
  srcRelPath: string,
  callIdentity: string,
) {
  const abs = (relPath: string) => join(cwd, relPath);
  const { cwd, config, cacheFullDir } = execContext;
  const typeInjectFullDir = join(cwd, dirname(config.typeInjectEntrypoint));

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
  const tsxRelPath = join(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = join(cacheFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${callIdentity}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = join(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = join(typeInjectFullDir, typesRootRelDir, dtsRelPath);
  return {
    srcRelPath,
    srcFullPath,
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
  };
}

export function resolveGraphQLDocument(
  importRootPath: string,
  gqlContent: string,
  cwd: string,
) {
  // This allows to start from content of GraphQL document, not file path
  const predefinedImports = { [importRootPath]: gqlContent };
  const map: VisitedFilesMap = new Map();
  try {
    const documentNode = processImport(
      importRootPath,
      cwd,
      predefinedImports,
      map,
    );
    const dependantFullPaths = Array.from(map.keys());
    return { documentNode, dependantFullPaths };
  } catch (e) {
    // Reformat error log to include source file and position information
    const { body, name } = e.source;
    const stack = e.stack.split('\n').slice(1).join('\n');
    const [{ line, column }] = e.locations;
    e.message = `${name}; ${e.message}\nIn line ${line}, column ${column} of the following source:\n${body}`;
    e.stack = stack;
    throw e;
  }
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
  const { documentNode, dependantFullPaths } = resolveGraphQLDocument(
    importRootPath,
    gqlContent,
    cwd,
  );
  const resolvedGqlContent = print(documentNode);
  const documentName = documentNode.definitions
    .map((d) => (d as OperationDefinitionNode).name!.value)
    .join('-');
  // We should use raw gqlContent instead of modified version resolvedGqlContent to get hash.
  const gqlHash = createHash(schemaHash + gqlContent);
  const createdPaths = createTiPaths(execContext, sourceRelPath, documentName);
  const { tsxFullPath, dtsFullPath } = createdPaths;
  const shouldUpdate =
    gqlHash !== readHash(tsxFullPath) || gqlHash !== readHash(dtsFullPath);
  return {
    gqlHash,
    createdPaths,
    shouldUpdate,
    resolvedGqlContent,
    dependantFullPaths,
  };
}

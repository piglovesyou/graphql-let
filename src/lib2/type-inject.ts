import { processImport } from '@graphql-tools/import';
import { DocumentNode, OperationDefinitionNode, print } from 'graphql';
import { ExecContext } from '../lib/exec-context';
import { readHash } from '../lib/file';
import { createHash } from '../lib/hash';
import { createTiPaths } from './fns';

function resolveGraphQLDocument(
  cwd: string,
  sourceFullPath: string,
  gqlContent: string,
): DocumentNode {
  // This allows to start from content of GraphQL document, not file path
  const predefinedImports = { [sourceFullPath]: gqlContent };
  return processImport(sourceFullPath, cwd, predefinedImports);
}

export function prepareAppendTiContext(
  execContext: ExecContext,
  schemaHash: string,
  sourceRelPath: string,
  sourceFullPath: string,
  gqlContent: string,
) {
  const { cwd } = execContext;
  const documentNode = resolveGraphQLDocument(cwd, sourceFullPath, gqlContent);
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

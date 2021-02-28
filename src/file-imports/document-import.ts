import { join as pathJoin } from 'path';
import { ExecContext } from '../lib/exec-context';
import { readFileSync } from '../lib/file';
import { createHash, readHash } from '../lib/hash';
import { createPaths } from '../lib/paths';
import { CodegenContext, FileCodegenContext } from '../lib/types';

export function appendFileContext(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  gqlRelPaths: string[],
  gqlContents?: string[],
): void {
  if (!gqlRelPaths.length) return;

  const { cwd } = execContext;

  for (const [i, gqlRelPath] of gqlRelPaths.entries()) {
    // Loader passes gqlContent directly
    const gqlContent = gqlContents
      ? gqlContents[i]
      : readFileSync(pathJoin(cwd, gqlRelPath), 'utf-8');
    if (!gqlContent) throw new Error('never');

    const createdPaths = createPaths(execContext, gqlRelPath);
    const { tsxFullPath, dtsFullPath } = createdPaths;

    // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
    // basically depends on schema, which change should effect to document results.
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== readHash(tsxFullPath) || gqlHash !== readHash(dtsFullPath);

    const context: FileCodegenContext = {
      ...createdPaths,
      type: 'document-import',
      gqlHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
  }
}

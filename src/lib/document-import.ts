import { join } from 'path';
import { ExecContext } from './exec-context';
import { readFileSync } from './file';
import { createHash, readHash } from './hash';
import { createPaths } from './paths';
import { CodegenContext, DocumentImportCodegenContext } from './types';

export function appendDocumentImportContext(
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
      : readFileSync(join(cwd, gqlRelPath), 'utf-8');
    if (!gqlContent) throw new Error('never');

    const createdPaths = createPaths(execContext, gqlRelPath);
    const { tsxFullPath, dtsFullPath } = createdPaths;

    // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
    // basically depends on schema, which change should effect to document results.
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== readHash(tsxFullPath) || gqlHash !== readHash(dtsFullPath);

    const context: DocumentImportCodegenContext = {
      ...createdPaths,
      type: 'document-import',
      gqlHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
  }
}

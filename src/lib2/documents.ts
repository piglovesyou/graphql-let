import glob from 'globby';
import { join as pathJoin } from 'path';
import { ExecContext } from '../lib/exec-context';
import { readFileSync, readHash } from '../lib/file';
import { createHash } from '../lib/hash';
import { createPaths, isTypeScriptPath } from '../lib/paths';
import { CodegenContext, FileCodegenContext } from '../lib/types';

export async function findTargetDocuments({
  cwd,
  config,
}: ExecContext): Promise<{
  graphqlRelPaths: string[];
  tsSourceRelPaths: string[];
}> {
  const documentPaths = await glob(config.documents, {
    cwd,
    gitignore: config.respectGitIgnore,
  });
  if (documentPaths.length === 0) {
    throw new Error(
      `No GraphQL documents are found from the path ${JSON.stringify(
        config.documents,
      )}. Check "documents" in .graphql-let.yml.`,
    );
  }
  const graphqlRelPaths: string[] = [];
  const tsSourceRelPaths: string[] = [];
  for (const p of documentPaths) {
    isTypeScriptPath(p) ? tsSourceRelPaths.push(p) : graphqlRelPaths.push(p);
  }
  return { graphqlRelPaths, tsSourceRelPaths };
}

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
      type: 'document',
      gqlHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
  }
}

// Take care of `.graphql`s
import glob from 'globby';
import { join as pathJoin } from 'path';
import { ExecContext } from './exec-context';
import { readFile, readHash } from './file';
import { processGraphQLCodegen } from './graphql-codegen';
import { createHash } from './hash';
import { createPaths, isTypeScriptPath } from './paths';
import { CodegenContext, FileCodegenContext } from './types';

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

export async function processDocumentsForContext(
  execContext: ExecContext,
  gqlRelPaths: string[],
  schemaHash: string,
  codegenContext: CodegenContext[],
) {
  if (!gqlRelPaths.length) return;

  const { cwd, config, codegenOpts } = execContext;
  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(pathJoin(cwd, gqlRelPath), 'utf-8');

    const createdPaths = createPaths(execContext, gqlRelPath);
    const { tsxFullPath, dtsFullPath } = createdPaths;

    // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
    // basically depends on schema, which change should effect to document results.
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== (await readHash(tsxFullPath)) ||
      gqlHash !== (await readHash(dtsFullPath));

    const context: FileCodegenContext = {
      ...createdPaths,
      gqlHash,
      dtsContentDecorator: (s) => s,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);

    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.
      await processGraphQLCodegen({
        cwd,
        schema: config.schema,
        plugins: config.plugins,
        config: codegenOpts.config,
        filename: tsxFullPath,
        gqlHash,
        documents: gqlRelPath,
      });
    }
  }
}

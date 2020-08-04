import glob from 'globby';
import { processDocumentsForContext } from './documents';
import { processDtsForContext } from './dts';
import { ExecContext } from './exec-context';
import { processLiteralsForContext } from './literals';
import { isTypeScriptPath } from './paths';
import { processResolverTypesIfNeeded } from './resolver-types';
import { CodegenContext } from './types';

export async function prepareFullGenerate({
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

async function fullGenerate(
  execContext: ExecContext,
): Promise<CodegenContext[]> {
  const codegenContext: CodegenContext[] = [];

  const { graphqlRelPaths, tsSourceRelPaths } = await prepareFullGenerate(
    execContext,
  );

  const { schemaHash } = await processResolverTypesIfNeeded(
    execContext,
    codegenContext,
  );

  await processDocumentsForContext(
    execContext,
    graphqlRelPaths,
    schemaHash,
    codegenContext,
  );

  await processLiteralsForContext(
    execContext,
    schemaHash,
    tsSourceRelPaths,
    codegenContext,
  );

  await processDtsForContext(execContext, codegenContext);

  return codegenContext;
}

export default fullGenerate;

import glob from 'globby';
import {
  appendLiteralAndLoadContextForTsSources,
  writeTiIndexForContext,
} from './call-expressions/handle-codegen-context';
import { appendFileContext } from './file-imports/document-import';
import { appendFileSchemaContext } from './file-imports/schema-import';
import { processCodegenForContext } from './lib/codegen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { isTypeScriptPath } from './lib/paths';
import { updateLog } from './lib/print';
import { CodegenContext, CommandOpts, isAllSkip } from './lib/types';

async function findTargetSources({
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

async function removeObsoleteFiles(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
): Promise<void> {}

export async function gen({
  cwd,
  configFilePath,
}: CommandOpts): Promise<CodegenContext[]> {
  updateLog('Running graphql-codegen...');

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);
  const codegenContext: CodegenContext[] = [];

  const { graphqlRelPaths, tsSourceRelPaths } = await findTargetSources(
    execContext,
  );

  const { schemaHash } = await appendFileSchemaContext(
    execContext,
    codegenContext,
  );

  appendFileContext(execContext, schemaHash, codegenContext, graphqlRelPaths);

  appendLiteralAndLoadContextForTsSources(
    execContext,
    schemaHash,
    codegenContext,
    tsSourceRelPaths,
  );

  if (!isAllSkip(codegenContext)) {
    writeTiIndexForContext(execContext, codegenContext);

    await processCodegenForContext(execContext, codegenContext);

    await processDtsForContext(execContext, codegenContext);
  }

  await removeObsoleteFiles(execContext, codegenContext);

  return codegenContext;
}

export default gen;

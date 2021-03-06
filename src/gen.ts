import { unlinkSync } from 'fs';
import glob from 'globby';
import { dirname, extname, join as pathJoin } from 'path';
import slash from 'slash';
import {
  appendLiteralAndLoadContextForTsSources,
  writeTiIndexForContext,
} from './call-expressions/handle-codegen-context';
import { typesRootRelDir } from './call-expressions/type-inject';
import { appendFileContext } from './file-imports/document-import';
import { appendFileSchemaContext } from './file-imports/schema-import';
import { processCodegenForContext } from './lib/codegen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { isTypeScriptPath, toDtsPath } from './lib/paths';
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

/*
 * Currently, "graphql-let" CLI only removes obsolete files. Maybe we can
 * in webpack and Babel but it should not be urgent.
 */
async function removeObsoleteFiles(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  graphqlRelPaths: string[],
): Promise<void> {
  const { cwd, config } = execContext;

  const generatedFiles = new Set<string>(
    // TODO: Use flatMap after unsupporting Node 10
    codegenContext
      .reduce(
        (acc, { tsxFullPath, dtsFullPath }) =>
          acc.concat([tsxFullPath, dtsFullPath]),
        [] as string[],
      )
      .map(slash),
  );

  const globsToRemove = new Set<string>();

  for (const relPath of graphqlRelPaths) {
    const ext = extname(relPath);
    const pattern = toDtsPath(pathJoin(cwd, dirname(relPath), '*' + ext));
    globsToRemove.add(pattern);
  }

  const projectTypeInjectFullDir = pathJoin(
    cwd,
    dirname(config.typeInjectEntrypoint),
    typesRootRelDir,
    '**/*',
  );
  globsToRemove.add(projectTypeInjectFullDir);

  const cacheFullDir = pathJoin(cwd, config.cacheDir, '**/*');
  globsToRemove.add(cacheFullDir);

  const candidates = await glob(Array.from(globsToRemove), { absolute: true });
  for (const fullPath of candidates.map(slash))
    if (!generatedFiles.has(fullPath)) unlinkSync(fullPath);
}

export async function gen({
  cwd,
  configFilePath,
}: CommandOpts): Promise<CodegenContext[]> {
  updateLog('Scanning...');

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

  if (isAllSkip(codegenContext)) {
    updateLog(
      `Nothing to do. Caches for ${codegenContext.length} GraphQL documents are fresh.`,
    );
  } else {
    const numToProcess = codegenContext.reduce(
      (i, { skip }) => (skip ? i : i + 1),
      0,
    );
    updateLog(`Processing ${numToProcess} codegen...`);

    writeTiIndexForContext(execContext, codegenContext);

    await processCodegenForContext(execContext, codegenContext);

    updateLog(`Generating ${numToProcess} d.ts...`);
    await processDtsForContext(execContext, codegenContext);

    const displayNum =
      numToProcess === codegenContext.length
        ? numToProcess
        : `${numToProcess}/${codegenContext.length}`;
    updateLog(`Done processing ${displayNum} GraphQL documents.`);
  }

  await removeObsoleteFiles(execContext, codegenContext, graphqlRelPaths);

  return codegenContext;
}

export default gen;

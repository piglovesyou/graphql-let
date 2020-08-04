import globby from 'globby';
import logUpdate from 'log-update';
import {
  findTargetDocuments,
  processDocumentsForContext,
} from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import loadConfig from './lib/config';
import { processLiteralsForContext } from './lib/literals';
import { updateLog } from './lib/print';
import { processResolverTypesIfNeeded } from './lib/resolver-types';
import { CommandOpts, CodegenContext } from './lib/types';
import { rimraf } from './lib/file';
import { join } from 'path';

async function removeOldTsxCaches(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cacheFullDir } = execContext;
  const validTsxs = new Set<string>(
    codegenContext.map(({ tsxFullPath }) => tsxFullPath),
  );
  const oldTsxPaths = await globby(
    [join(cacheFullDir, '/**/*.ts'), join(cacheFullDir, '/**/*.tsx')],
    { absolute: true },
  );
  await Promise.all(
    oldTsxPaths.filter((e) => !validTsxs.has(e)).map((e) => rimraf(e)),
  );
}

export default async function gen({
  cwd,
  configFilePath,
}: CommandOpts): Promise<CodegenContext[]> {
  updateLog('Running graphql-codegen...');

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);
  const codegenContext: CodegenContext[] = [];

  const { graphqlRelPaths, tsSourceRelPaths } = await findTargetDocuments(
    execContext,
  );

  const { schemaHash } = await processResolverTypesIfNeeded(
    execContext,
    codegenContext,
  );

  await processDocumentsForContext(
    execContext,
    schemaHash,
    codegenContext,
    graphqlRelPaths,
  );

  await processLiteralsForContext(
    execContext,
    schemaHash,
    tsSourceRelPaths,
    codegenContext,
  );

  updateLog('Generating .d.ts...');
  await processDtsForContext(execContext, codegenContext);

  await removeOldTsxCaches(execContext, codegenContext);

  if (codegenContext.filter((e) => !e.skip).length) {
    updateLog(`${codegenContext.length} .d.ts were generated.`);
  } else {
    updateLog(`Done nothing, caches are fresh.`);
  }
  logUpdate.done();

  return codegenContext;
}

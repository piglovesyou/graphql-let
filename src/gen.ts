import globby from 'globby';
import logUpdate from 'log-update';
import {
  findTargetDocuments,
  processDocumentsForContext,
} from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import loadConfig, { ConfigTypes } from './lib/config';
import { processLiteralsForContext } from './lib/literals';
import { getCacheFullDir } from './lib/paths';
import { updateLog } from './lib/print';
import { processResolverTypesIfNeeded } from './lib/resolver-types';
import { CommandOpts, CodegenContext } from './lib/types';
import { rimraf } from './lib/file';

async function removeOldTsxCaches(
  cwd: string,
  config: ConfigTypes,
  codegenContext: CodegenContext[],
) {
  const cacheDir = getCacheFullDir(cwd, config.cacheDir);
  const validTsxCaches = codegenContext.map(({ tsxFullPath }) => tsxFullPath);
  const oldTsxPaths = await globby(
    [cacheDir + '/**', ...validTsxCaches.map((validCache) => '!' + validCache)],
    { absolute: true },
  );
  for (const tsx of oldTsxPaths) await rimraf(tsx);
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

  await removeOldTsxCaches(cwd, config, codegenContext);

  if (codegenContext.filter((e) => !e.skip).length) {
    updateLog(`${codegenContext.length} .d.ts were generated.`);
  } else {
    updateLog(`Done nothing, caches are fresh.`);
  }
  logUpdate.done();

  return codegenContext;
}

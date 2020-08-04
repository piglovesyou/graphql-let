import globby from 'globby';
import logUpdate from 'log-update';
import createExecContext from './lib/exec-context';
import fullGenerate from './lib/full-generate';
import loadConfig, { ConfigTypes } from './lib/config';
import { getCacheFullDir } from './lib/paths';
import { updateLog } from './lib/print';
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
}: CommandOpts): Promise<void> {
  updateLog('Running graphql-codegen...');

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);

  const codegenContext = await fullGenerate(execContext);

  await removeOldTsxCaches(cwd, config, codegenContext);

  if (codegenContext.filter((e) => !e.skip).length) {
    updateLog(`${codegenContext.length} .d.ts were generated.`);
  } else {
    updateLog(`Done nothing, caches are fresh.`);
  }
  logUpdate.done();
}

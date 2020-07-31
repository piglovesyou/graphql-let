import globby from 'globby';
import createExecContext from './lib/exec-context';
import fullGenerate, {
  CodegenContext,
  SkippedContext,
} from './lib/full-generate';
import loadConfig from './lib/load-config';
import { getCacheFullDir } from './lib/paths';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';
import logUpdate from 'log-update';
import { rimraf } from './lib/file';

async function removeOldTsxCaches(
  cwd: string,
  config: ConfigTypes,
  codegenContext: CodegenContext[],
  skippedContext: SkippedContext[],
) {
  const cacheDir = getCacheFullDir(cwd, config.cacheDir);
  const validTsxCaches = [
    ...codegenContext.map(({ tsxFullPath }) => tsxFullPath),
    ...skippedContext.map(({ tsxFullPath }) => tsxFullPath),
  ];
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
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);

  const [generated, skipped] = await fullGenerate(execContext);

  await removeOldTsxCaches(cwd, config, generated, skipped);

  if (generated.length) {
    logUpdate(PRINT_PREFIX + `${generated.length} .d.ts were generated.`);
  } else {
    logUpdate(PRINT_PREFIX + `Done nothing, caches are fresh.`);
  }
  logUpdate.done();
}

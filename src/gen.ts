import globby from 'globby';
import fullGenerate from './lib/full-generate';
import loadConfig from './lib/load-config';
import { getCacheFullDir } from './lib/paths';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';
import logUpdate from 'log-update';
import { rimraf } from './lib/file';

async function removeOldTsxCaches(
  cwd: string,
  config: ConfigTypes,
  codegenContext: {
    tsxFullPath: string;
    dtsFullPath: string;
    gqlRelPath: string;
    gqlHash: string;
    dtsContentDecorator: (content: string) => string;
  }[],
) {
  const cacheDir = getCacheFullDir(cwd, config.cacheDir);
  const oldTsxPaths = await globby(
    [
      cacheDir + '/**',
      ...codegenContext.map(({ tsxFullPath }) => '!' + tsxFullPath),
    ],
    { absolute: true },
  );
  for (const tsx of oldTsxPaths) await rimraf(tsx);
}

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { cwd, configFilePath } = commandOpts;
  const [config, configHash] = await loadConfig(cwd, configFilePath);

  const codegenContext = await fullGenerate(cwd, config, configHash);

  await removeOldTsxCaches(cwd, config, codegenContext);

  if (codegenContext) {
    logUpdate(PRINT_PREFIX + `${codegenContext.length} .d.ts were generated.`);
  } else {
    logUpdate(PRINT_PREFIX + `Done nothing, caches are fresh.`);
  }
  logUpdate.done();
}

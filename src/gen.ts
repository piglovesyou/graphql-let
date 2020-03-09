import fullGenerate from './lib/full-generate';
import loadConfig from './lib/load-config';
import { createDtsRelDir } from './lib/paths';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts } from './lib/types';
import logUpdate from 'log-update';

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { cwd } = commandOpts;
  const [config, configHash] = await loadConfig(cwd);

  const numberAffected = await fullGenerate(cwd, config, configHash);

  if (numberAffected) {
    logUpdate(
      PRINT_PREFIX +
        `${numberAffected} .d.ts were generated in ${createDtsRelDir(
          config.generateDir,
        )}.`,
    );
  } else {
    logUpdate(PRINT_PREFIX + `Done nothing, caches are still fresh.`);
  }
  logUpdate.done();
}

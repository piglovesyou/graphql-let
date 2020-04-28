import fullGenerate from './lib/full-generate';
import loadConfig from './lib/load-config';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts } from './lib/types';
import logUpdate from 'log-update';

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { cwd, configFilePath } = commandOpts;
  const [config, configHash] = await loadConfig(cwd, configFilePath);

  const numberAffected = await fullGenerate(cwd, config, configHash);

  if (numberAffected) {
    logUpdate(PRINT_PREFIX + `${numberAffected} .d.ts were generated.`);
  } else {
    logUpdate(PRINT_PREFIX + `Done nothing, caches are fresh.`);
  }
  logUpdate.done();
}

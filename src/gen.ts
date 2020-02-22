import { parse as parseYaml } from 'yaml';
import fullGenerate from './lib/full-generate';
import { createDtsRelDir } from './lib/paths';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';
import logUpdate from 'log-update';
import { readFile } from './lib/file';

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

  const numberAffected = await fullGenerate(config, cwd);

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

import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import fullGenerate from './lib/full-generate';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';
import logUpdate from 'log-update';

const { readFile } = fsPromises;

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

  await fullGenerate(config, cwd);
}

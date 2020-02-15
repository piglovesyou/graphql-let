import path from 'path';
import _rimraf from 'rimraf';
import { promisify } from 'util';
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import fullGenerate from './lib/full-generate';
import { PRINT_PREFIX } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';
import logUpdate from 'log-update';

const { readFile } = fsPromises;
const rimraf = promisify(_rimraf);

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

  // When we rebuild from schema, we have to restart from very beginning.
  await rimraf(path.join(cwd, config.generateDir));

  await fullGenerate(config, cwd);
}

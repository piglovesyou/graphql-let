import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { readFile, readFileSync } from './file';
import { ConfigTypes } from './types';
import { createHash } from './hash';

const getConfigPath = (cwd: string, configFilePath?: string) =>
  pathJoin(cwd, configFilePath || DEFAULT_CONFIG_FILENAME);
const getConfigFromContent = (content: string): [ConfigTypes, string] => [
  parseYaml(content),
  createHash(content),
];

// TODO:
// function validate(config: ConfigTypes) { }
// function fillDefaultValues(config: ConfigTypes) { }

export default async function loadConfig(
  cwd: string,
  configFilePath?: string,
): Promise<[ConfigTypes, string]> {
  const configPath = getConfigPath(cwd, configFilePath);
  const content = await readFile(configPath, 'utf-8');
  return getConfigFromContent(content);
}

export function loadConfigSync(
  cwd: string,
  configFilePath?: string,
): [ConfigTypes, string] {
  const configPath = getConfigPath(cwd, configFilePath);
  const content = readFileSync(configPath, 'utf-8');
  return getConfigFromContent(content);
}

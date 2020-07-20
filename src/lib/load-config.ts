import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'fs';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { ConfigTypes } from './types';
import { createHash } from './hash';

export default function loadConfig(
  cwd: string,
  configFilePath?: string,
): [ConfigTypes, string] {
  const configPath = pathJoin(cwd, configFilePath || DEFAULT_CONFIG_FILENAME);
  const content = readFileSync(configPath, 'utf-8');
  const configHash = createHash(content);
  const config: ConfigTypes = parseYaml(content);
  return [config, configHash];
}

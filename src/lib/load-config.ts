import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { readFile } from './file';
import { ConfigTypes } from './types';
import getHash from './hash';

export default async function loadConfig(
  cwd: string,
): Promise<[ConfigTypes, string]> {
  const configPath = pathJoin(cwd, DEFAULT_CONFIG_FILENAME);
  const content = await readFile(configPath, 'utf-8');
  const configHash = await getHash(content);
  const config: ConfigTypes = parseYaml(content);
  return [config, configHash];
}

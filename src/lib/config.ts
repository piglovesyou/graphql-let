import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { readFile, readFileSync } from './file';
import { createHash } from './hash';

export type RawConfigTypes = {
  schema: string | Record<string, any>;
  documents: string | string[];
  plugins: Array<string | Record<string, any>>;
  // Optional. "true" is the default value.
  respectGitIgnore?: boolean;
  // Optional. "{}" is the default value.
  config?: Record<string, any>;
  // Optional. "node_modules/graphql-let/__generated__" is the default value.
  cacheDir?: string;
  // Optional. "tsconfig.json" is the default value.
  TSConfigFile?: string;
  // Optional. "node_modules/@types/graphql-let/index.d.ts" is the default value.
  // Necessary if you use Babel Plugin "graphql-let/babel".
  gqlDtsEntrypoint?: string;
};

export type ConfigTypes = Required<RawConfigTypes>;

const requiredFields = ['schema', 'documents', 'plugins'];

export function buildConfig(raw: any): ConfigTypes {
  if (typeof raw !== 'object')
    throw new Error('A config file must shape an object');
  for (const name of requiredFields)
    if (!raw[name]) throw new Error(`A config requires a "${name}" field`);
  // TODO: More verify
  return {
    ...raw,
    config: raw.config || {},
    cacheDir: raw.cacheDir || 'node_modules/graphql-let/__generated__',
    TSConfigFile: raw.TSConfigFile || 'tsconfig.json',
    gqlDtsEntrypoint:
      raw.gqlDtsEntrypoint || 'node_modules/@types/graphql-let/index.d.ts',
  };
}

const getConfigPath = (cwd: string, configFilePath?: string) =>
  pathJoin(cwd, configFilePath || DEFAULT_CONFIG_FILENAME);

const getConfigFromContent = (content: string): [ConfigTypes, string] => [
  buildConfig(parseYaml(content)),
  createHash(content),
];

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

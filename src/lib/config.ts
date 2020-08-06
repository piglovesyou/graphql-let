import { Types } from '@graphql-codegen/plugin-helpers/types';
import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { readFile, readFileSync } from './file';
import { createHash } from './hash';
import { printError } from './print';

export type PartialGraphqlCodegenOptions = Omit<Types.Config, 'generates'>;

export type GraphQLLetAdditionalOptions = {
  // Required. Goes to `codegen.generates[outFile].plugins`.
  plugins: Array<string | Record<string, any>>;
  // Optional. "true" is the default value.
  respectGitIgnore?: boolean;
  // Optional. "node_modules/graphql-let/__generated__" is the default value.
  cacheDir?: string;
  // Optional. "tsconfig.json" is the default value.
  TSConfigFile?: string;
  // Optional. "node_modules/@types/graphql-let/index.d.ts" is the default value.
  // Necessary if you use Babel Plugin "graphql-let/babel".
  gqlDtsEntrypoint?: string;
  // Optional.
  generateOptions?: Types.ConfiguredOutput;
};

export type UserConfigTypes = PartialGraphqlCodegenOptions &
  GraphQLLetAdditionalOptions;
export type ConfigTypes = PartialGraphqlCodegenOptions & {
  documents: Types.OperationDocumentGlobPath[];
} & Required<GraphQLLetAdditionalOptions>;

export function buildConfig(raw: UserConfigTypes): ConfigTypes {
  if (typeof raw !== 'object')
    printError(new Error('A config file must shape an object'));

  if (!raw.schema || !raw.documents || !raw.plugins)
    printError(new Error(`A config requires a "${name}" field`));

  const documents: Types.OperationDocumentGlobPath[] = Array.isArray(
    raw.documents,
  )
    ? (raw.documents as Types.OperationDocumentGlobPath[])
    : typeof raw.documents === 'string'
    ? [raw.documents]
    : (printError(
        new Error(`config.documents should be an array or a string`),
      ) as never);

  return {
    ...raw,
    // Normalized codegen options
    documents,
    // Set graphql-let default values
    respectGitIgnore: true,
    cacheDir: raw.cacheDir || 'node_modules/graphql-let/__generated__',
    TSConfigFile: raw.TSConfigFile || 'tsconfig.json',
    gqlDtsEntrypoint:
      raw.gqlDtsEntrypoint || 'node_modules/@types/graphql-let/index.d.ts',
    generateOptions: raw.generateOptions || Object.create(null),
  };
}

export const getConfigPath = (cwd: string, configFilePath?: string) =>
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

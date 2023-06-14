import { Types } from '@graphql-codegen/plugin-helpers';
import { dirname, resolve } from 'path';
import { env } from 'string-env-interpolation';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_FILENAME } from './consts';
import { readFile, readFileSync } from './file';
import { createHash } from './hash';
import { SCHEMA_TYPES_BASENAME } from './paths';
import { printError, printWarning } from './print';

type PartialGraphqlCodegenOptions = Omit<Types.Config, 'generates'>;

type GraphQLLetAdditionalOptions = {
  plugins: Array<string | Record<string, any>>;
  respectGitIgnore?: boolean;
  cacheDir?: string;
  cwd?: string;
  TSConfigFile?: string;
  // gqlDtsEntrypoint?: string;
  typeInjectEntrypoint?: string;
  generateOptions?: Types.ConfiguredOutput;
  silent?: boolean;
};

export type UserConfigTypes = PartialGraphqlCodegenOptions &
  GraphQLLetAdditionalOptions;
export type ConfigTypes = PartialGraphqlCodegenOptions & {
  documents: Types.OperationDocumentGlobPath[];
} & Required<GraphQLLetAdditionalOptions>;

function buildConfig(raw: UserConfigTypes, configDir: string): ConfigTypes {
  if (typeof raw !== 'object')
    printError(new Error('A config file must shape an object'));

  if (!raw.schema || !raw.documents || !raw.plugins)
    printError(new Error(`A config requires a "${name}" field`));

  const hasUnnecessaryPlugin = raw.plugins.some((p) => {
    const name = typeof p === 'string' ? p : Object.keys(p)[0];
    return name === 'typescript';
  });
  if (hasUnnecessaryPlugin)
    printWarning(
      `A plugin "typescript" should not appear in your config since graphql-let automatically generates types in "graphql-let/__generated__/${SCHEMA_TYPES_BASENAME}", which each document's output internally imports.
You can still have it, but it's redundant and can be problem if the types are massive, especially in product environment. More information: https://github.com/piglovesyou/graphql-let/issues/60
`,
    );

  if ((raw as any).schemaEntrypoint)
    printError(
      new Error(
        `An option "schemaEntrypoint" is deprecated. Remove it from the config and import types from "graphql-let/__generated__/${SCHEMA_TYPES_BASENAME}".`,
      ),
    );

  // @ts-ignore
  if (raw.gqlDtsEntrypoint)
    printError(
      new Error(
        `"gqlDtsEntrypoint" is deprecated. Rewrite the key to "typeInjectEntrypoint".`,
      ),
    );

  const documents: Types.OperationDocumentGlobPath[] = Array.isArray(
    raw.documents,
  )
    ? (raw.documents as Types.OperationDocumentGlobPath[])
    : typeof raw.documents === 'string'
    ? [raw.documents]
    : (printError(
        new Error(`config.documents should be an array or a string`),
      ) as never);

  if (documents.some((doc) => doc.indexOf('../') === 0))
    printError(
      new Error(
        `"documents" should not escape the config directory and must have a common ancestor. 
        Consider using cwd to set the common parent folder and define documents relative from that.`,
      ),
    );

  return {
    ...raw,
    // Normalized codegen options
    documents,
    cwd: raw.cwd ? resolve(configDir, raw.cwd) : configDir,
    // Set graphql-let default values
    respectGitIgnore:
      raw.respectGitIgnore !== undefined ? raw.respectGitIgnore : true,
    cacheDir: raw.cacheDir || 'node_modules/.cache/graphql-let',
    TSConfigFile: raw.TSConfigFile || 'tsconfig.json',
    typeInjectEntrypoint:
      raw.typeInjectEntrypoint || 'node_modules/@types/graphql-let/index.d.ts',
    generateOptions: raw.generateOptions || Object.create(null),
    silent: raw.silent || false,
  };
}

const getConfigPath = (cwd: string, configFilePath?: string) =>
  resolve(cwd, configFilePath || DEFAULT_CONFIG_FILENAME);

const getConfigFromContent = (
  content: string,
  configDir: string,
): [ConfigTypes, string] => {
  content = env(content);
  return [buildConfig(parseYaml(content), configDir), createHash(content)];
};

// Refactor with gensync
export default async function loadConfig(
  cwd: string,
  configFilePath?: string,
): Promise<[ConfigTypes, string]> {
  const configPath = getConfigPath(cwd, configFilePath);
  const content = await readFile(configPath, 'utf-8');
  return getConfigFromContent(content, dirname(configPath));
}

export function loadConfigSync(
  cwd: string,
  configFilePath?: string,
): [ConfigTypes, string] {
  const configPath = getConfigPath(cwd, configFilePath);
  const content = readFileSync(configPath, 'utf-8');
  return getConfigFromContent(content, dirname(configPath));
}

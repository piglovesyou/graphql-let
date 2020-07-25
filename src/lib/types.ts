export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

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

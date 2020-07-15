export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

export type ConfigTypes = {
  cacheDir?: string;
  config?: Record<string, boolean | string>;
  schema: string | Record<string, any>;
  documents: string | string[];
  respectGitIgnore: boolean;
  plugins: Array<string | Record<string, any>>;
  TSConfigFile?: string;
};

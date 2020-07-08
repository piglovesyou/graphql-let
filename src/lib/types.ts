export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

export type ConfigTypes = {
  cacheDir?: string;
  config?: Record<string, boolean | string>;
  schema: string;
  documents: string | string[];
  respectGitIgnore: boolean;
  plugins: Array<string | { [name: string]: any }>;
  TSConfigFile?: string;
};

export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

export type ConfigTypes = {
  config?: Record<string, boolean | string>;
  schema: string;
  documents: string | string[];
  respectGitIgnore: boolean;
  plugins: string[];
};

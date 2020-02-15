export type CommandOpts = {
  cwd: string;
  configPath: string;
};

export type ConfigTypes = {
  generateDir: string;
  config?: Record<string, boolean | string>;
  schema: string | string[];
  documents: string | string[];
  respectGitIgnore: boolean;
  plugins: string[];
};

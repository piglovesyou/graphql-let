export type CommandOpts = {
  cwd: string;
  configPath: string;
  noResolverTypes: boolean;
};

export type ConfigTypes = {
  generateDir: string;
  config?: Record<string, boolean | string>;
  schema: string;
  documents: string | string[];
  plugins: string[];
};

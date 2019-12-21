export type CommandOpts = {
  cwd: string;
  configPath: string;
};

export type ConfigTypes = {
  config?: Record<string, boolean | string>;
  schema: string;
  documents: string;
  plugins: string[];
};

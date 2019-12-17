export type CommandOpts = {
  cwd: string;
  configPath: string;
};

export type ConfigTypes = {
  config?: any;
  schema: string;
  documents: string;
  plugins: string[];
}

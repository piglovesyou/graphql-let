import { stringify as yamlStringify } from 'yaml';
import { writeFileSync } from 'fs';
import { printInfo } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';

const DEFAULT_CONFIG: ConfigTypes = {
  generateDir: '__generated__',
  schema: '**/*.graphqls',
  documents: '**/*.graphql',
  plugins: ['typescript'],
  respectGitIgnore: true,
};

const defaultYamlContent = yamlStringify(DEFAULT_CONFIG);

export default function init({ configPath }: CommandOpts) {
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

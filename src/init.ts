import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify as yamlStringify } from 'yaml';
import { UserConfigTypes } from './lib/config';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { printInfo } from './lib/print';
import { CommandOpts } from './lib/types';

const DEFAULT_CONFIG: UserConfigTypes = {
  schema: '**/*.graphqls',
  documents: '**/*.graphql',
  plugins: ['typescript'],
};

const defaultYamlContent = yamlStringify(DEFAULT_CONFIG);

export default function init({ cwd }: CommandOpts) {
  const configPath = join(cwd, DEFAULT_CONFIG_FILENAME);
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

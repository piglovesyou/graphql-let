import { join as pathJoin } from 'path';
import { stringify as yamlStringify } from 'yaml';
import { writeFileSync } from 'fs';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { UserConfigTypes } from './lib/config';
import { printInfo } from './lib/print';
import { CommandOpts } from './lib/types';

const DEFAULT_CONFIG: UserConfigTypes = {
  schema: 'lib/type-defs.graphqls',
  documents: '**/*.graphql',
  plugins: ['typescript'],
  respectGitIgnore: true,
};

const defaultYamlContent = yamlStringify(DEFAULT_CONFIG);

export default function init({ cwd }: CommandOpts) {
  const configPath = pathJoin(cwd, DEFAULT_CONFIG_FILENAME);
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

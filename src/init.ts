import { stringify as yamlStringify } from 'yaml';
import { writeFileSync } from 'fs';
import { printInfo } from './lib/print';
import { CommandOpts, ConfigTypes } from './lib/types';

const defaultYamlContent = yamlStringify({
  generateDir: '__generated__',
  schema: ['!node_modules', '**/*.graphqls'],
  documents: ['**/*.graphql'],
  plugins: ['typescript'],
} as ConfigTypes);

export default function init({ configPath }: CommandOpts) {
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

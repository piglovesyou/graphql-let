import { stringify as yamlStringify } from 'yaml';
import { writeFileSync } from 'fs';
import { printInfo } from './lib/print';
import { CommandOpts } from './lib/types';

const defaultYamlContent = yamlStringify({
  generateDir: '__generated__',
  schema: '**/*.graphqls',
  documents: '**/*.graphql',
  plugins: ['typescript'],
});

export default function init({ configPath }: CommandOpts) {
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

import { stringify as yamlStringify } from 'yaml';
import { writeFileSync } from 'fs';
import { printInfo } from './print';
import { CommandOpts } from './types';

const defaultYamlContent = yamlStringify({
  schema: 'path/to/**/*.graphqls',
  documents: 'path/to/**/*.graphql',
  plugins: ['typescript'],
});

export default function init({ configPath }: CommandOpts) {
  writeFileSync(configPath, defaultYamlContent);

  printInfo(`${configPath} was created.`);
}

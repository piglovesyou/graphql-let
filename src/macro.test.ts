import runner from '@babel/helper-transform-fixture-test-runner';
import glob from 'globby';
import { join } from 'path';
import { spawn } from './lib/__tools/child-process';
import { cleanup } from './lib/__tools/file';

const cwd = join(__dirname, '.__fixtures/macro');

beforeAll(async () => {
  await cleanup(cwd, ['**/node_modules']);
});

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

test(`Type checking for all fixtures`, async () => {
  const dirs = await glob(['*/*'], {
    cwd,
    onlyDirectories: true,
    absolute: true,
  });
  for (const dir of dirs) await spawn('yarn', ['tsc'], { cwd: dir });
});

// test(`Generated files are okay`, async () => {
//   await matchPathsAndContents(['**/node_modules/**'], cwd);
// });

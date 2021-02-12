import runner from '@babel/helper-transform-fixture-test-runner';
import { join } from 'path';
import { cleanup } from '../__tools/file';
import { matchPathsAndContents } from '../__tools/match-paths-and-contents';

const cwd = join(__dirname, '__fixtures');

beforeAll(async () => {
  await cleanup(cwd, ['**/node_modules']);
});

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

test(`Generated files are okay`, async () => {
  await matchPathsAndContents(['**/node_modules/**'], cwd);
});

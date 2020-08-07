import { join } from 'path';
import runner from '@babel/helper-transform-fixture-test-runner';
import { cleanup } from './__tools/file';
import { matchPathsAndContents } from './__tools/match-paths-and-contents';

const cwd = join(__dirname, '__fixtures/babel');

beforeAll(() => cleanup(cwd));

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

test(`Generated files are okay`, async () => {
  await matchPathsAndContents('fixtures/*/node_modules/**', cwd);
});

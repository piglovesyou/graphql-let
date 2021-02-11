import runner from '@babel/helper-transform-fixture-test-runner';
import { join } from 'path';
import { matchPathsAndContents } from '../__tools/match-paths-and-contents';

const cwd = join(__dirname, '__fixtures');

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

// Needs "describe", otherwise the order of running another "describe" in @babel/helper-transform-fixture-test-runner switches.
describe('babel-plugin', () => {
  test(`Generated files are okay`, async () => {
    await matchPathsAndContents(['suite/*/node_modules/**'], cwd);
  });
});

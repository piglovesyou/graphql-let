import { join } from 'path';
import runner from '@babel/helper-transform-fixture-test-runner';
import { rimraf } from './__tools/file';

const cwd = join(__dirname, '__fixtures/babel');

beforeAll(async () => {
  await rimraf(join(cwd, '**/node_modules'));
});

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

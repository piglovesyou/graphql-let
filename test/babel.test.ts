import { deepStrictEqual } from 'assert';
import globby from 'globby';
import { join } from 'path';
import runner from '@babel/helper-transform-fixture-test-runner';
import { cleanup, readFile } from './__tools/file';

const cwd = join(__dirname, '__fixtures/babel');
const rel = (path: string) => join(cwd, path);

beforeAll(() => cleanup(cwd));

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

test(`Generated files are okay`, async () => {
  const files = (await globby('fixtures/*/node_modules/**', { cwd })).sort();
  expect(files).toMatchSnapshot();

  for (const file of files)
    expect(await readFile(rel(file))).toMatchSnapshot(file);
});

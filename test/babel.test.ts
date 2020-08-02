import { deepStrictEqual } from 'assert';
import globby from 'globby';
import { join } from 'path';
import runner from '@babel/helper-transform-fixture-test-runner';
import { readFile, rimraf } from './__tools/file';
import { clearExecContext } from '../src/babel';

const cwd = join(__dirname, '__fixtures/babel');
const rel = (path: string) => join(cwd, path);

beforeAll(async () => {
  await rimraf(join(cwd, '**/node_modules'));
});

// We cache "config", etc. for production.
// Here we traverse multiple fixture projects, so erase them for each.
beforeEach(() => clearExecContext());

runner(cwd, 'gql', {}, { sourceType: 'unambiguous' });

test(`Generated files are okay`, async () => {
  const files = await globby('fixtures/**/node_modules/**', { cwd });

  deepStrictEqual(
    files.sort(),

    [
      'fixtures/basic/node_modules/@types/graphql-let/index.d.ts',
      'fixtures/basic/node_modules/@types/graphql-let/input-dcfbe2c23b6ad8dfa8d9e2dc133c788c60c28ea8.d.ts',
      'fixtures/basic/node_modules/@types/graphql-let/store.json',
      'fixtures/basic/node_modules/graphql-let/__generated__/input-dcfbe2c23b6ad8dfa8d9e2dc133c788c60c28ea8.tsx',
      'fixtures/tagged-template-call/node_modules/@types/graphql-let/index.d.ts',
      'fixtures/tagged-template-call/node_modules/@types/graphql-let/input-dcfbe2c23b6ad8dfa8d9e2dc133c788c60c28ea8.d.ts',
      'fixtures/tagged-template-call/node_modules/@types/graphql-let/store.json',
      'fixtures/tagged-template-call/node_modules/graphql-let/__generated__/input-dcfbe2c23b6ad8dfa8d9e2dc133c788c60c28ea8.tsx',
    ],
  );

  const contents = await Promise.all(
    files.map((file) => {
      return readFile(rel(file)).then((content) => [file, content]);
    }),
  );

  for (const [file, content] of contents) expect(content).toMatchSnapshot(file);
});

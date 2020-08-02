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
  const files = await globby('fixtures/*/node_modules/**', { cwd });

  deepStrictEqual(files.sort(), [
    'fixtures/basic/node_modules/@types/graphql-let/index.d.ts',
    'fixtures/basic/node_modules/@types/graphql-let/input-a5b1d9187125652b08b1a55be5bf7de54696d6ee.d.ts',
    'fixtures/basic/node_modules/@types/graphql-let/store.json',
    'fixtures/basic/node_modules/graphql-let/__generated__/input-a5b1d9187125652b08b1a55be5bf7de54696d6ee.tsx',
    'fixtures/tagged-template-call/node_modules/@types/graphql-let/index.d.ts',
    'fixtures/tagged-template-call/node_modules/@types/graphql-let/input-a5b1d9187125652b08b1a55be5bf7de54696d6ee.d.ts',
    'fixtures/tagged-template-call/node_modules/@types/graphql-let/store.json',
    'fixtures/tagged-template-call/node_modules/graphql-let/__generated__/input-a5b1d9187125652b08b1a55be5bf7de54696d6ee.tsx',
  ]);

  const contents = await Promise.all(
    files.map((file) => {
      return readFile(rel(file)).then((content) => [file, content]);
    }),
  );

  for (const [file, content] of contents) expect(content).toMatchSnapshot(file);
});

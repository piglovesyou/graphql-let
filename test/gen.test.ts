/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { join as pathJoin } from 'path';
import { deepStrictEqual, strictEqual } from 'assert';
import gen from '../src/gen';
import glob from 'globby';
import { readFile, rename, rimraf } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/gen');
const rel = (relPath: string) => pathJoin(cwd, relPath);

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    await rename(rel('_gitignore'), rel('.gitignore'));
    await rimraf(pathJoin(__dirname, '../__generated__'));
    await rimraf(rel('**/*.graphql.d.ts'));
    await rimraf(rel('**/*.graphqls.d.ts'));
  }, 60 * 1000);

  afterAll(async () => {
    await rename(rel('.gitignore'), rel('_gitignore'));
    await rimraf(rel('**/*.graphql.d.ts'));
    await rimraf(rel('**/*.graphqls.d.ts'));
  });

  test(`generates number of .d.ts ignoring specified files as expected
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`, async () => {
    await gen({ cwd });

    const docDtsGlobResults = await glob('**/*.graphql.d.ts', { cwd });
    strictEqual(
      docDtsGlobResults.find((r) => r.includes('shouldBeIgnored1')),
      undefined,
    );
    const docDtsGlobContents = await Promise.all(
      docDtsGlobResults.map((filename) =>
        readFile(rel(filename)).then((content) => ({ filename, content })),
      ),
    );
    docDtsGlobContents.forEach(({ filename, content }) => {
      expect(content).toMatchSnapshot(filename);
    });

    const schemaDtsGlobResults = await glob('**/*.graphqls.d.ts', { cwd });
    strictEqual(schemaDtsGlobResults.length, 1);

    const schemaDtsGlobContents = await Promise.all(
      schemaDtsGlobResults.map((filename) =>
        readFile(rel(filename)).then((content) => ({ filename, content })),
      ),
    );
    schemaDtsGlobContents.forEach(({ filename, content }) => {
      expect(content).toMatchSnapshot(filename);
    });

    const tsxResults = await glob(
      'test/__fixtures/gen/__generated__/**/*.tsx',
      {
        cwd,
      },
    );
    strictEqual(tsxResults.length, 3);
    strictEqual(
      tsxResults.find((r) => r.includes('shouldBeIgnored1')),
      undefined,
    );
    const tsxContents = await Promise.all(
      tsxResults.map((filename) =>
        readFile(pathJoin(cwd, filename)).then((content) => ({
          filename,
          content,
        })),
      ),
    );
    tsxContents.forEach(({ filename, content }) => {
      expect(content).toMatchSnapshot(filename);
    });
  });

  test(`runs twice and keeps valid caches`, async () => {
    await gen({ cwd });
    await gen({ cwd });
    const actual = await glob('test/__fixtures/gen/__generated__/**/*.tsx', {
      cwd,
    });
    deepStrictEqual(actual, [
      'test/__fixtures/gen/__generated__/pages/viewer.graphql.tsx',
      'test/__fixtures/gen/__generated__/pages/viewer2.graphql.tsx',
      'test/__fixtures/gen/__generated__/schema/type-defs.graphqls.tsx',
    ]);
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    await gen({ cwd });

    const actual = await readFile(rel('schema/type-defs.graphqls.d.ts'));
    expect(actual).toMatchSnapshot();
  });
});

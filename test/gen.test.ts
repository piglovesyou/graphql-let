/* eslint-disable @typescript-eslint/no-non-null-assertion */

import globby from 'globby';
import { join as pathJoin } from 'path';
import { deepStrictEqual, strictEqual } from 'assert';
import gen from '../src/gen';
import glob from 'globby';
import { readFile, rename, rimraf } from './__tools/file';
import { assertObjectsInclude } from './__tools/object';

const cwd = pathJoin(__dirname, '__fixtures/gen');
const rel = (relPath: string) => pathJoin(cwd, relPath);

function cleanup() {
  return Promise.all([
    rimraf(rel('__generated__')),
    rimraf(rel('node_modules')),
    rimraf(rel('**/*.graphql.d.ts')),
    rimraf(rel('**/*.graphqls.d.ts')),
  ]);
}

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    await rename(rel('_gitignore'), rel('.gitignore'));
  }, 60 * 1000);

  beforeEach(cleanup);

  afterAll(async () => {
    await rename(rel('.gitignore'), rel('_gitignore'));
    // await cleanup();
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

    const tsxResults = await glob('__generated__/**/*.tsx', {
      cwd,
    });
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
    assertObjectsInclude(await gen({ cwd }), [
      {
        gqlRelPath: 'schema/type-defs.graphqls',
        tsxRelPath: 'schema/type-defs.graphqls.tsx',
        dtsRelPath: 'schema/type-defs.graphqls.d.ts',
        gqlHash: '14d70566f4d02e53323ea8c820b4a3edeecc4672',
        skip: false,
      },
      {
        gqlRelPath: 'pages/viewer.graphql',
        tsxRelPath: 'pages/viewer.graphql.tsx',
        dtsRelPath: 'pages/viewer.graphql.d.ts',
        gqlHash: 'c4ffa0d4a98b9173e641f88cb713cbbaa35a8692',
        skip: false,
      },
      {
        gqlRelPath: 'pages/viewer2.graphql',
        tsxRelPath: 'pages/viewer2.graphql.tsx',
        dtsRelPath: 'pages/viewer2.graphql.d.ts',
        gqlHash: 'b2463a5b834ec0328b95dd554ca377c66498827e',
        skip: false,
      },
    ]);

    assertObjectsInclude(await gen({ cwd }), [
      {
        gqlRelPath: 'schema/type-defs.graphqls',
        tsxRelPath: 'schema/type-defs.graphqls.tsx',
        dtsRelPath: 'schema/type-defs.graphqls.d.ts',
        gqlHash: '14d70566f4d02e53323ea8c820b4a3edeecc4672',
        skip: true,
      },
      {
        gqlRelPath: 'pages/viewer.graphql',
        tsxRelPath: 'pages/viewer.graphql.tsx',
        dtsRelPath: 'pages/viewer.graphql.d.ts',
        gqlHash: 'c4ffa0d4a98b9173e641f88cb713cbbaa35a8692',
        skip: true,
      },
      {
        gqlRelPath: 'pages/viewer2.graphql',
        tsxRelPath: 'pages/viewer2.graphql.tsx',
        dtsRelPath: 'pages/viewer2.graphql.d.ts',
        gqlHash: 'b2463a5b834ec0328b95dd554ca377c66498827e',
        skip: true,
      },
    ]);

    const actual = await glob('__generated__/**/*.tsx', {
      cwd,
    });
    deepStrictEqual(actual.sort(), [
      '__generated__/pages/viewer.graphql.tsx',
      '__generated__/pages/viewer2.graphql.tsx',
      '__generated__/schema/type-defs.graphqls.tsx',
    ]);
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    await gen({ cwd });

    const actual = await readFile(rel('schema/type-defs.graphqls.d.ts'));
    expect(actual).toMatchSnapshot();
  });

  test(`documents: **/*.tsx generates .d.ts for babel`, async () => {
    const expectedFiles = [
      '__generated__/pages/index-c307b608d6f3bd4130e526f0de83cbe05bff54cd.tsx',
      '__generated__/pages/viewer.graphql.tsx',
      '__generated__/pages/viewer2.graphql.tsx',
      '__generated__/schema/type-defs.graphqls.tsx',
      'node_modules/@types/graphql-let/index.d.ts',
      'node_modules/@types/graphql-let/pages/index-c307b608d6f3bd4130e526f0de83cbe05bff54cd.d.ts',
      'node_modules/@types/graphql-let/store.json',
    ];
    await gen({ cwd, configFilePath: '.graphql-let-babel.yml' });

    const files = await globby(['__generated__', 'node_modules'], { cwd });
    deepStrictEqual(files.sort(), expectedFiles.sort());

    const contents = await Promise.all(
      files.map((file) => {
        return readFile(rel(file)).then((content) => [file, content]);
      }),
    );
    for (const [file, content] of contents)
      expect(content).toMatchSnapshot(file);
  });
});

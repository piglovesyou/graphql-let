/* eslint-disable @typescript-eslint/no-non-null-assertion */

import globby from 'globby';
import { join as pathJoin } from 'path';
import { deepStrictEqual } from 'assert';
import gen from '../src/gen';
import glob from 'globby';
import { cleanup, readFile, rename } from './__tools/file';
import pick from 'lodash.pick';

const cwd = pathJoin(__dirname, '__fixtures/gen');
const rel = (relPath: string) => pathJoin(cwd, relPath);

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    await rename(rel('_gitignore'), rel('.gitignore'));
  }, 60 * 1000);

  beforeEach(() => cleanup(cwd));

  afterAll(async () => {
    await rename(rel('.gitignore'), rel('_gitignore'));
    // await cleanup();
  });

  test(
    `generates number of .d.ts ignoring specified files as expected
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`,
    async () => {
      await gen({ cwd });

      const docDtsGlobResults = await glob('**/*.graphql.d.ts', { cwd });
      deepStrictEqual(
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
      deepStrictEqual(schemaDtsGlobResults.length, 1);

      const schemaDtsGlobContents = await Promise.all(
        schemaDtsGlobResults.map((filename) =>
          readFile(rel(filename)).then((content) => ({ filename, content })),
        ),
      );
      schemaDtsGlobContents.forEach(({ filename, content }) => {
        expect(content).toMatchSnapshot(filename);
      });

      const tsxResults = (
        await glob('__generated__/**/*.tsx', {
          cwd,
        })
      ).sort();
      deepStrictEqual(tsxResults.length, 4);
      expect(tsxResults).toMatchSnapshot('tsxResults');
      for (const tsxRelPath of tsxResults)
        expect(await readFile(pathJoin(cwd, tsxRelPath))).toMatchSnapshot(
          tsxRelPath,
        );
    },
    1000 * 1000,
  );

  test(`runs twice and keeps valid caches`, async () => {
    const properties = [
      'gqlRelPath',
      'tsxRelPath',
      'dtsRelPath',
      'gqlHash',
      'skip',
    ];
    const result1 = await gen({ cwd });
    expect(result1.map((context) => pick(context, properties))).toMatchSnapshot(
      'skip: false',
    );

    const files1 = await glob('__generated__/**/*.tsx', { cwd });
    expect(files1.sort()).toMatchSnapshot('should same');

    const result2 = await gen({ cwd });
    expect(result2.map((context) => pick(context, properties))).toMatchSnapshot(
      'skip: true',
    );

    const files2 = await glob('__generated__/**/*.tsx', { cwd });
    expect(files2.sort()).toMatchSnapshot('should same');
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    await gen({ cwd });

    const actual = await readFile(rel('schema/type-defs.graphqls.d.ts'));
    expect(actual).toMatchSnapshot();
  });

  test(`documents: **/*.tsx generates .d.ts for babel`, async () => {
    await gen({ cwd, configFilePath: '.graphql-let-babel.yml' });

    const files = await globby(['__generated__', 'node_modules'], { cwd });
    expect(files.sort()).toMatchSnapshot('paths');

    for (const file of files)
      expect(await readFile(pathJoin(cwd, file))).toMatchSnapshot(file);
  });
});

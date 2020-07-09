/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { join as pathJoin } from 'path';
import { strictEqual, ok } from 'assert';
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

    await gen({ cwd });
  }, 60 * 1000);

  afterAll(async () => {
    await rename(rel('.gitignore'), rel('_gitignore'));
    // await rimraf(rel('**/*.graphql.d.ts'));
    // await rimraf(rel('**/*.graphqls.d.ts'));
  });

  test(`generates number of .d.ts ignoring specified files as expected
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`, async () => {
    const docDtsGlobResults = await glob('**/*.graphql.d.ts', { cwd });
    strictEqual(
      docDtsGlobResults.find((r) => r.includes('shouldBeIgnored1')),
      undefined,
    );

    const schemaDtsGlobResults = await glob('**/*.graphqls.d.ts', { cwd });
    strictEqual(schemaDtsGlobResults.length, 1);

    const tsxResults = await glob('../__generated__/**/*.tsx', {
      cwd: __dirname,
    });
    strictEqual(
      tsxResults.find((r) => r.includes('shouldBeIgnored1')),
      undefined,
    );
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    const actual = await readFile(rel('schema/type-defs.graphqls.d.ts'));
    ok(
      actual.includes(`
export declare type WithIndex<TObject> = TObject & Record<string, any>;
export declare type ResolversObject<TObject> = WithIndex<TObject>;
`),
    );
  });
});

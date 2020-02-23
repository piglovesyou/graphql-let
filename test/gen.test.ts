/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { join as pathJoin } from 'path';
import assert from 'assert';
import gen from '../src/gen';
import glob from 'globby';

import { readFile, rename, rimraf } from './lib/file';
const cwd = pathJoin(__dirname, 'fixtures/gen');
const rel = (relPath: string) => pathJoin(cwd, relPath);

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    await rename(rel('_gitignore'), rel('.gitignore'));
    await rimraf(rel('__generated__'));

    await gen({
      cwd,
      configPath: rel('.graphql-let.yml'),
    });
  }, 60 * 1000);
  afterAll(async () => {
    await rename(rel('.gitignore'), rel('_gitignore'));
  });

  test(`generates number of .d.ts ignoring specified files as expected
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`, async () => {
    const expectDtsLength = 3; // 2 documents and 1 schema

    const globResults = await glob('__generated__/types/**', { cwd });
    assert.strictEqual(globResults.length, expectDtsLength);

    const [schema, doc1, doc2] = globResults.sort();
    const d = '^__generated__/types';
    const h = '[a-z\\d]+';
    assert(new RegExp(`${d}/viewer.graphql-${h}.d.ts$`).test(doc1));
    assert(new RegExp(`${d}/viewer2.graphql-${h}.d.ts$`).test(doc2));
    assert(new RegExp(`${d}/__concatedschema__-${h}.d.ts$`).test(schema));
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    const [
      generatedSchemaTypesPath,
    ] = await glob('__generated__/types/__concatedschema__*', { cwd });
    const actual = await readFile(rel(generatedSchemaTypesPath));
    assert.ok(
      actual.includes(`
  export type WithIndex<TObject> = TObject & Record<string, any>;
  export type ResolversObject<TObject> = WithIndex<TObject>;
`),
    );
  });
});

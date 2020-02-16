/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { join as pathJoin } from 'path';
import assert from 'assert';
import gen from '../src/gen';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import { promises } from 'fs';

const rimraf = promisify(_rimraf);
const { rename } = promises;

const cwd = pathJoin(__dirname, 'fixtures/gen');
const rel = (relPath: string) => pathJoin(cwd, relPath);

describe('"graphql-let" command', () => {
  beforeAll(async () => await rename(rel('_gitignore'), rel('.gitignore')));
  afterAll(async () => await rename(rel('.gitignore'), rel('_gitignore')));

  test(
    `generates .d.ts
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`,
    async () => {
      const expectDtsLength = 3; // 2 documents and 1 schema

      await rimraf(rel('__generated__'));
      await gen({
        cwd,
        configPath: rel('.graphql-let.yml'),
      });

      const globResults = await glob('__generated__/types/**', { cwd });
      assert.strictEqual(globResults.length, expectDtsLength);

      const [schema, doc1, doc2] = globResults.sort();
      const d = '^__generated__/types';
      const h = '[a-z\\d]+';
      assert(new RegExp(`${d}/viewer.graphql-${h}.d.ts$`).test(doc1));
      assert(new RegExp(`${d}/viewer2.graphql-${h}.d.ts$`).test(doc2));
      assert(new RegExp(`${d}/__concatedschema__-${h}.d.ts$`).test(schema));
    },
    60 * 1000,
  );
});

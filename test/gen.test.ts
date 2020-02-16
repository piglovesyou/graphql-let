/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from 'path';
import assert from 'assert';
import gen from '../src/gen';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

const cwd = path.join(__dirname, 'fixtures/gen');

test(
  '"graphql-let" generates .d.ts',
  async () => {
    const expectDtsLength = 3; // 2 for documents and 1 for schema

    await rimraf(path.join(cwd, '__generated__'));
    await gen({
      cwd,
      configPath: path.join(cwd, '.graphql-let.yml'),
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

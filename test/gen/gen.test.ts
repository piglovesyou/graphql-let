/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from 'path';
import assert from 'assert';
import gen from '../../src/gen';
import glob from 'fast-glob';
import { promisify } from 'util';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

test(
  '"graphql-let" generates .d.ts',
  async () => {
    const expectDtsLength = 3; // 2 for documents and 1 for schema

    await rimraf(path.join(__dirname, '__generated__'));
    await gen({
      cwd: __dirname,
      configPath: path.join(__dirname, '.graphql-let.yml'),
    });

    const globResults = await glob('__generated__/types/**', {
      cwd: __dirname,
    });
    const { length } = globResults;
    assert.strictEqual(length, expectDtsLength);

    const [schema, doc1, doc2] = globResults.sort();
    const genDir = '^__generated__/types';
    const hash = '[a-z\\d]+';
    assert(new RegExp(`${genDir}/viewer.graphql-${hash}.d.ts$`).test(doc1));
    assert(new RegExp(`${genDir}/viewer2.graphql-${hash}.d.ts$`).test(doc2));
    assert(
      new RegExp(`${genDir}/__concatedschema__-${hash}.d.ts$`).test(schema),
    );
  },
  60 * 1000,
);

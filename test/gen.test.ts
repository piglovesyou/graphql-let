/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from 'path';
import assert from 'assert';
import gen from '../src/gen';
import glob from 'fast-glob';
import { promisify } from 'util';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

test(
  '"graphql-let" generates .d.ts',
  async () => {
    const expect = [
      '__generated__/types/viewer.graphql-33e322e3dadea27c5f274eda803fd353ad6ab510.d.ts',
    ];

    await rimraf(path.join(__dirname, '__generated__'));
    await gen({
      cwd: __dirname,
      configPath: path.join(__dirname, '.graphql-let.yml'),
    });
    const actual = await glob('__generated__/types/**', { cwd: __dirname });
    assert.deepStrictEqual(actual, expect);
  },
  60 * 1000,
);

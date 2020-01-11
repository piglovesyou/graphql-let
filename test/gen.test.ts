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
    const expect = new RegExp(
      '^__generated__/types/viewer.graphql-[a-z\\d]+.d.ts$',
    );

    await rimraf(path.join(__dirname, '__generated__'));
    await gen({
      cwd: __dirname,
      configPath: path.join(__dirname, '.graphql-let.yml'),
    });
    const { length, 0: actual } = await glob('__generated__/types/**', {
      cwd: __dirname,
    });
    assert.strictEqual(length, 1);
    assert(expect.test(actual));
  },
  60 * 1000,
);

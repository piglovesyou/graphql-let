/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from 'path';
import assert from 'assert';
import gen from '../src/gen';
import { promisify } from 'util';
import { existsSync } from 'fs';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

test(
  '"graphql-let" generates .d.ts',
  async () => {
    await rimraf(path.join(__dirname, '__generated__'));
    await gen({
      cwd: __dirname,
      configPath: path.join(__dirname, '.graphql-let.yml'),
    });
    assert(
      existsSync(
        path.join(__dirname, '__generated__/types/viewer.graphql.d.ts'),
      ),
    );
  },
  60 * 1000,
);

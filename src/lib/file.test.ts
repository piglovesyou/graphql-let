import { ok, strictEqual } from 'assert';
import { join as pathJoin } from 'path';
import { readHash } from './file';

describe('file.ts', () => {
  test('readHash reads file from generated file', async () => {
    const hash = await readHash(
      pathJoin(__dirname, '__fixtures/file/dummy-graphql-d-ts.txt'),
    );
    if (!hash) throw new Error('boom');
    strictEqual(hash.length, 40);
    ok(/^[a-z0-9]+$/.test(hash));
  });
});

import { readHash } from '../../src/lib/file';
import { join as pathJoin } from 'path';
import { ok, strictEqual } from 'assert';

describe('file.ts', () => {
  test('readHash reads file from generated file', async () => {
    const hash = await readHash(
      pathJoin(__dirname, '../__fixtures/file/a.graphql.d.ts'),
    );
    if (!hash) throw new Error('boom');
    strictEqual(hash.length, 40);
    ok(/^[a-z0-9]+$/.test(hash));
  });
});

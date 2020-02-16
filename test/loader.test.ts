/* eslint-disable @typescript-eslint/no-non-null-assertion */

import assert from 'assert';
import glob from 'globby';
import compiler from './lib/compile';
import { promisify } from 'util';
import { join as pathJoin } from 'path';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

const cwd = pathJoin(__dirname, 'fixtures/loader');

describe('graphql-let/loader', () => {
  beforeEach(async () => {
    await rimraf(pathJoin(cwd, '__generated__'));
  });

  test(
    'generates .tsx and .d.ts',
    async () => {
      const fixture = 'pages/viewer.graphql';
      const stats = await compiler(cwd, fixture, 'node');
      const { 0: actual, length } = stats
        .toJson()
        .modules!.map(m => m.source)
        .filter(Boolean);

      assert.deepStrictEqual(length, 1);
      assert(actual!.includes('export function useViewerQuery('));
    },
    60 * 1000,
  );

  test(
    'runs well for simultaneous execution assuming SSR',
    async () => {
      const expect = new RegExp(
        '^__generated__/types/viewer.graphql-[a-z\\d]+.d.ts$',
      );
      const fixtures: [string, 'node' | 'web'][] = [
        ['pages/viewer.graphql', 'node'],
        ['pages/viewer.graphql', 'web'],
        ['pages/viewer2.graphql', 'node'],
        ['pages/viewer2.graphql', 'web'],
      ];
      const results = await Promise.all(
        fixtures.map(([file, target]) => compiler(cwd, file, target)),
      );
      for (const [i, stats] of results.entries()) {
        const [file] = fixtures[i];
        const { 0: actual, length } = stats
          .toJson()
          .modules!.map(m => m.source)
          .filter(Boolean);

        assert.deepStrictEqual(length, 1);
        switch (file) {
          case 'pages/viewer.graphql':
            assert(actual!.includes('export function useViewerQuery('));
            break;
          case 'pages/viewer2.graphql':
            assert(actual!.includes('export function useViewer2Query('));
            break;
        }
      }
      const { length, 0: actual } = await glob('__generated__/types/**', {
        cwd,
      });
      assert.strictEqual(length, 2);
      assert(expect.test(actual));
    },
    60 * 1000,
  );
});

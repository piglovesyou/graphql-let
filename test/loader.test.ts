/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { deepStrictEqual, ok, strictEqual } from 'assert';
import glob from 'globby';
import compiler from './__tools/compile';
import { join as pathJoin } from 'path';
import { rimraf } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/loader');

describe('graphql-let/loader', () => {
  beforeEach(async () => {
    await rimraf(pathJoin(cwd, '__generated__'));
  });

  test('generates .tsx and .d.ts by .graphql', async () => {
    const fixture = 'pages/viewer.graphql';
    const stats = await compiler(cwd, fixture, 'node');
    const { 0: actual, length } = stats
      .toJson()
      .modules!.map((m) => m.source)
      .filter(Boolean);

    deepStrictEqual(length, 1);
    expect(actual).toMatchSnapshot();
  });

  test('generates .tsx and .d.ts by .tsx', async () => {
    const fixture = 'pages/index.tsx';
    const stats = await compiler(cwd, fixture, 'node');
    const { 0: actual, length } = stats
      .toJson()
      .modules!.map((m) => m.source)
      .filter(Boolean);

    deepStrictEqual(length, 1);
    expect(actual).toMatchSnapshot();
  });

  test('runs well for simultaneous execution, assuming SSR', async () => {
    const expectedTargets: [string, 'node' | 'web'][] = [
      ['pages/viewer.graphql', 'node'],
      ['pages/viewer2.graphql', 'node'],
      ['pages/index.tsx', 'node'],
      ['pages/viewer.graphql', 'web'],
      ['pages/viewer2.graphql', 'web'],
      ['pages/index.tsx', 'web'],
    ];
    const results = await Promise.all(
      expectedTargets.map(([file, target]) => compiler(cwd, file, target)),
    );
    for (const [i, stats] of results.entries()) {
      const [file] = expectedTargets[i];
      const { 0: actual, length } = stats
        .toJson()
        .modules!.map((m) => m.source)
        .filter(Boolean);

      deepStrictEqual(length, 1);
      switch (file) {
        case 'pages/viewer.graphql':
          ok(actual!.includes('export function useViewerQuery('));
          break;
        case 'pages/viewer2.graphql':
          ok(actual!.includes('export function useViewer2Query('));
          break;
      }
    }
    const globResults = await glob('**/*.graphql.d.ts', { cwd });
    strictEqual(globResults.length, 2);
  });
});

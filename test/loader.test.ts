/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { deepStrictEqual, ok, strictEqual } from 'assert';
import 'core-js/es/array';
import * as fs from 'fs';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { promisify } from 'util';
import waitOn from 'wait-on';
import compiler from './__tools/compile';

const unlink = promisify(fs.unlink);

const fixturePath1 = pathJoin(__dirname, '__fixtures/loader/usual');
const fixturePath2 = pathJoin(__dirname, '__fixtures/loader/monorepo');

describe('graphql-let/loader', () => {
  test('generates .tsx and .d.ts', async () => {
    const fixture = 'pages/viewer.graphql';
    const stats = await compiler(fixturePath1, fixture, 'node');
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
      ['pages/viewer.graphql', 'web'],
      ['pages/viewer2.graphql', 'node'],
      ['pages/viewer2.graphql', 'web'],
    ];
    const results = await Promise.all(
      expectedTargets.map(([file, target]) =>
        compiler(fixturePath1, file, target),
      ),
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
    const globResults = await glob('**/*.graphql.d.ts', { cwd: fixturePath1 });
    strictEqual(globResults.length, 2);
  });

  describe('options', () => {
    async function acceptsConfigPathInOptionsConfigFile(
      configFilePath: string,
    ) {
      const stats = await compiler(
        pathJoin(fixturePath2, 'packages/app'),
        'src/index.ts',
        'web',
        { configFile: configFilePath },
      );

      const modules = stats
        .toJson()
        .modules?.flatMap((m) => m.modules)
        ?.filter(Boolean);

      ok(modules);
      expect(modules.map((m) => m.name)).toMatchInlineSnapshot(`
        Array [
          "./src/index.ts",
          "./src/fruits.graphql",
        ]
      `);

      const generated = modules.find((m) => m?.name === './src/fruits.graphql');

      ok(generated);

      await waitOn({
        resources: [
          `${fixturePath2}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ],
      });

      expect(generated.source).toContain('export function useGetFruitsQuery');
      expect(
        generated.source?.replace(/\/\*[\s\S]*?\*\//g, ''),
      ).toMatchSnapshot();

      await Promise.all([
        unlink(
          `${fixturePath2}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ),
        unlink(`${fixturePath2}/packages/app/src/fruits.graphql.d.ts`),
      ]).catch(() => {
        /* discard error */
      });
    }

    test('accept relative config path in options.configFile', async () => {
      await acceptsConfigPathInOptionsConfigFile(
        '../../config/.graphql-let.yml',
      );
    });

    test('accept absolute config path in options.configFile', async () => {
      await acceptsConfigPathInOptionsConfigFile(
        require.resolve('./__fixtures/loader/monorepo/config/.graphql-let.yml'),
      );
    });
  });
});

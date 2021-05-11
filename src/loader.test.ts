/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ok } from 'assert';
import 'core-js/es/array';
import * as fs from 'fs';
import { join as pathJoin } from 'path';
import { promisify } from 'util';
import waitOn from 'wait-on';
import { Stats } from 'webpack';
import * as print from './lib/print';
import compiler from './lib/__tools/compile';
import { prepareFixtures } from './lib/__tools/file';
import { matchPathsAndContents } from './lib/__tools/match-paths-and-contents';

const unlink = promisify(fs.unlink);

const basicEntrypoints = ['pages/index.tsx', 'pages/viewer.graphql'];

function getOutputInfo(stats: Stats): string[] {
  const { modules } = stats.toJson()!;
  const names: string[] = [];
  (function getNamesAndOutputs(fnModules: Stats.FnModules[]) {
    for (const m of fnModules) {
      if (m.name && typeof m.source === 'string') names.push(m.name);
      if (m.modules) getNamesAndOutputs(m.modules);
    }
  })(modules!);
  return names;
}

describe('graphql-let/loader', () => {
  test('generates .tsx and .d.ts', async () => {
    const [fixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/basic',
    );
    const stats = await compiler(fixtureDir, basicEntrypoints, 'node');
    expect(getOutputInfo(stats)).toMatchInlineSnapshot(`
      Array [
        "./__generated__/__SCHEMA__.tsx",
        "./pages/viewer.graphql",
        "./pages/index.tsx",
        "./__generated__/pages/index-Viewer-Partial.tsx",
      ]
    `);
    await matchPathsAndContents(
      ['__generated__/**/*.tsx', '**/*.d.ts'],
      fixtureDir,
    );
  });

  test('runs well for simultaneous execution, assuming SSR', async () => {
    const [fixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/basic',
      '.__fixtures/loader/basic-ssr',
    );
    const expectedTargets: [string, 'node' | 'web'][] = [
      ['pages/index.tsx', 'node'],
      ['pages/index.tsx', 'web'],
      ['pages/viewer.graphql', 'node'],
      ['pages/viewer.graphql', 'web'],
      ['pages/viewer2.graphql', 'node'],
      ['pages/viewer2.graphql', 'web'],
    ];
    const results = await Promise.all(
      expectedTargets.map(([file, target]) =>
        compiler(fixtureDir, [file], target),
      ),
    );
    const sourceNames = results.flatMap((r) => getOutputInfo(r));
    expect(sourceNames).toMatchInlineSnapshot(`
      Array [
        "./__generated__/__SCHEMA__.tsx",
        "./pages/index.tsx",
        "./__generated__/pages/index-Viewer-Partial.tsx",
        "./__generated__/__SCHEMA__.tsx",
        "./pages/index.tsx",
        "./__generated__/pages/index-Viewer-Partial.tsx",
        "./pages/viewer.graphql",
        "./pages/viewer.graphql",
        "./pages/viewer2.graphql",
        "./pages/viewer2.graphql",
      ]
    `);
    expect(
      await matchPathsAndContents(
        [
          '**/__generated__/**/*.tsx',
          '**/__generated__/**/*.d.ts',
          '**/*.graphql.d.ts',
        ],
        fixtureDir,
      ),
    ).toMatchInlineSnapshot(`
      Array [
        "__generated__/__SCHEMA__.tsx",
        "__generated__/pages/index-Viewer-Partial.tsx",
        "__generated__/pages/index-ViewerY-Partial.tsx",
        "__generated__/pages/viewer.graphql.tsx",
        "__generated__/pages/viewer2.graphql.tsx",
        "node_modules/@types/graphql-let/__generated__/__SCHEMA__.d.ts",
        "node_modules/@types/graphql-let/__generated__/pages/index-Viewer-Partial.d.ts",
        "node_modules/@types/graphql-let/__generated__/pages/index-ViewerY-Partial.d.ts",
        "pages/viewer.graphql.d.ts",
        "pages/viewer2.graphql.d.ts",
      ]
    `);
  });

  test('The option "silent" suppresses standard output logs', async () => {
    const [fixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/silent',
    );
    let messages = '';
    const mockFn = (m: any) => (messages += m + '\n');
    jest.spyOn(print, 'printInfo').mockImplementation(mockFn);
    jest.spyOn(print, 'updateLog').mockImplementation(mockFn);

    await compiler(fixtureDir, basicEntrypoints, 'node');
    expect(messages).toHaveLength(0);
  });

  describe('options', () => {
    async function acceptsConfigPathInOptionsConfigFile(
      fixtureDir: string,
      configFilePath: string,
    ) {
      const stats = await compiler(
        pathJoin(fixtureDir, 'packages/app'),
        ['src/index.ts'],
        'web',
        { configFile: configFilePath },
      );

      const modules = stats
        .toJson()
        .modules?.flatMap((m) => m.modules)
        ?.filter(Boolean);

      ok(modules);
      expect(modules.map((m) => m.name)).toMatchSnapshot();

      const generated = modules.find((m) => m?.name === './src/fruits.graphql');

      ok(generated);

      await waitOn({
        resources: [
          `${fixtureDir}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ],
      });

      expect(generated.source).toContain('export function useGetFruitsQuery');
      expect(
        generated.source?.replace(/\/\*[\s\S]*?\*\//g, ''),
      ).toMatchSnapshot();

      await Promise.all([
        unlink(
          `${fixtureDir}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ),
        unlink(`${fixtureDir}/packages/app/src/fruits.graphql.d.ts`),
      ]).catch(() => {
        /* discard error */
      });
    }

    test('accept relative config path in options.configFile', async () => {
      const [fixtureDir] = await prepareFixtures(
        __dirname,
        '__fixtures/loader/monorepo',
        '.__fixtures/loader/monorepo-relpath',
      );
      await acceptsConfigPathInOptionsConfigFile(
        fixtureDir,
        '../../config/.graphql-let.yml',
      );
    });

    test('accept absolute config path in options.configFile', async () => {
      const [fixtureDir] = await prepareFixtures(
        __dirname,
        '__fixtures/loader/monorepo',
        '.__fixtures/loader/monorepo-fullpath',
      );
      await acceptsConfigPathInOptionsConfigFile(
        fixtureDir,
        require.resolve('./__fixtures/loader/monorepo/config/.graphql-let.yml'),
      );
    });
  });
});

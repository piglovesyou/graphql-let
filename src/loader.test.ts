/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ok, strictEqual } from 'assert';
import 'core-js/es/array';
import * as fs from 'fs';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { promisify } from 'util';
import waitOn from 'wait-on';
import { Stats } from 'webpack';
import * as print from './lib/print';
import compiler from './lib/__tools/compile';
import { prepareFixtures } from './lib/__tools/file';

const unlink = promisify(fs.unlink);

let basicFixtureDir: string;
let monorepoFixtureDir: string;
let silentFixtureDir: string;

const basicEntrypoints = ['pages/index.tsx', 'pages/viewer.graphql'];

function getOutputInfo(stats: Stats) {
  const { modules } = stats.toJson()!;
  const acc: [name: string, output: string][] = [];
  (function getNamesAndOutputs(fnModules: Stats.FnModules[]) {
    for (const m of fnModules) {
      if (m.name && m.source) acc.push([m.name, m.source]);
      if (m.modules) getNamesAndOutputs(m.modules);
    }
  })(modules!);
  return acc;
}

describe('graphql-let/loader', () => {
  beforeAll(async () => {
    [basicFixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/basic',
    );
    [monorepoFixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/monorepo',
    );
    [silentFixtureDir] = await prepareFixtures(
      __dirname,
      '__fixtures/loader/silent',
    );
  });

  test('generates .tsx and .d.ts', async () => {
    const stats = await compiler(basicFixtureDir, basicEntrypoints, 'node');
    const outputs = getOutputInfo(stats);
    expect(outputs).toHaveLength(4);

    const [, gqlOutput] = outputs.find(
      ([name]) => name === './pages/viewer.graphql',
    )!;
    expect(gqlOutput).toMatchSnapshot();
    const [, sourceOutput] = outputs.find(
      ([name]) => name === './pages/index.tsx',
    )!;
    expect(sourceOutput).toMatchSnapshot();
  });

  test('runs well for simultaneous execution, assuming SSR', async () => {
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
        compiler(basicFixtureDir, [file], target),
      ),
    );
    for (const [i, stats] of results.entries()) {
      const [file] = expectedTargets[i];
      const outputs = getOutputInfo(stats);
      const [, output] = outputs.find(([name]) => name === './' + file)!;
      expect(output).toMatchSnapshot();
    }
    const globResults = await glob('**/*.graphql.d.ts', {
      cwd: basicFixtureDir,
    });
    strictEqual(globResults.length, 2);
  });

  test('The option "silent" suppresses standard output logs', async () => {
    let messages = '';
    const mockFn = (m: any) => (messages += m + '\n');
    jest.spyOn(print, 'printInfo').mockImplementation(mockFn);
    jest.spyOn(print, 'updateLog').mockImplementation(mockFn);

    await compiler(basicFixtureDir, basicEntrypoints, 'node');
    expect(messages).toMatchSnapshot();

    messages = '';
    await compiler(silentFixtureDir, basicEntrypoints, 'node');
    expect(messages).toHaveLength(0);
  });

  describe('options', () => {
    async function acceptsConfigPathInOptionsConfigFile(
      configFilePath: string,
    ) {
      const stats = await compiler(
        pathJoin(monorepoFixtureDir, 'packages/app'),
        ['src/index.ts'],
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
          `${monorepoFixtureDir}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ],
      });

      expect(generated.source).toContain('export function useGetFruitsQuery');
      expect(
        generated.source?.replace(/\/\*[\s\S]*?\*\//g, ''),
      ).toMatchSnapshot();

      await Promise.all([
        unlink(
          `${monorepoFixtureDir}/packages/app/__generated__/src/fruits.graphql.tsx`,
        ),
        unlink(`${monorepoFixtureDir}/packages/app/src/fruits.graphql.d.ts`),
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

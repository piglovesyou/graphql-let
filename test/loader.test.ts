/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { deepStrictEqual, ok, strictEqual } from 'assert';
import glob from 'globby';
import webpack, { Stats } from 'webpack';
import compiler from './__tools/compile';
import { join as pathJoin } from 'path';
import { cleanup, rimraf } from './__tools/file';
import { matchPathsAndContents } from './__tools/match-paths-and-contents';
import FnModules = webpack.Stats.FnModules;

const cwd = pathJoin(__dirname, '__fixtures/loader');

type ResultSource = Record</*name*/ string, /*source*/ string>;
function collectResultSource(obj: any, acc: ResultSource = {}): ResultSource {
  if (Array.isArray(obj)) {
    for (const o of obj as Stats[]) collectResultSource(o, acc);
    return acc;
  }
  if (Array.isArray(obj.modules)) {
    for (const o of obj.modules as FnModules[]) collectResultSource(o, acc);
    return acc;
  }
  if (typeof obj.toJson === 'function') {
    return collectResultSource((obj as Stats).toJson(), acc);
  }
  if (typeof obj.name === 'string' && typeof obj.source === 'string') {
    const { name, source }: Stats.FnModules = obj;
    acc[name] = source;
    return acc;
  }
  return acc;
}

describe('graphql-let/loader', () => {
  beforeEach(() => cleanup(cwd));

  test('runs with GraphQL document files (.graphql)', async () => {
    const fixture = 'pages/viewer.graphql';
    const stats = await compiler(cwd, fixture, 'node');
    const actual = collectResultSource(stats);
    expect(actual).toMatchSnapshot();
    await matchPathsAndContents(['**/*.d.ts'], cwd);
  });

  test('runs with GraphQL document literals in .tsx', async () => {
    const fixture = 'pages/index.tsx';
    const stats = await compiler(cwd, fixture, 'node');
    const actual = collectResultSource(stats);
    expect(actual).toMatchSnapshot();
    await matchPathsAndContents(['**/*.d.ts'], cwd);
  });

  test('runs well for simultaneous execution, assuming SSR', async () => {
    const targetFiles: [string, 'node' | 'web'][] = [
      ['pages/viewer.graphql', 'node'],
      ['pages/viewer2.graphql', 'node'],
      ['pages/index.tsx', 'node'],
      ['pages/viewer.graphql', 'web'],
      ['pages/viewer2.graphql', 'web'],
      ['pages/index.tsx', 'web'],
    ];
    const stats = await Promise.all(
      targetFiles.map(([file, target]) => compiler(cwd, file, target)),
    );
    const actual = collectResultSource(stats);
    expect(actual).toMatchSnapshot();
    await matchPathsAndContents(['**/*.d.ts'], cwd);
  });
});

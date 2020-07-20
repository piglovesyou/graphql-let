import type { Config } from '@jest/types';
import jestTransformer from '../src/jestTransformer';
import compiler from './__tools/compile';
import { join as pathJoin } from 'path';
import { rimraf } from './__tools/file';
import { readFileSync } from 'fs';

const cwd = pathJoin(__dirname, '__fixtures/jestTransformer');
const jestConfig = { rootDir: cwd } as Config.ProjectConfig;

describe('graphql-let/jestTransformer', () => {
  beforeEach(async () => {
    await rimraf(pathJoin(cwd, '__generated__'));
  });

  test('transforms .graphql', async () => {
    const fileName = 'pages/viewer.graphql';
    const stats = await compiler(cwd, fileName, 'node');
    const { 0: fileData } = stats
      .toJson()
      .modules!.map((m) => m.source)
      .filter(Boolean);

    const fullPath = pathJoin(cwd, fileName);
    const transformedContent = jestTransformer.process(
      fileData!,
      fullPath,
      jestConfig,
    );
    expect(transformedContent).toMatchSnapshot();
  });

  test('transforms .graphqls', async () => {
    jest.requireActual('jest-transform-graphql');
    const fileName = 'schema/type-defs.graphqls';

    const fullPath = pathJoin(cwd, fileName);
    const fileData = readFileSync(fullPath, 'utf-8');
    const transformedContent = jestTransformer.process(
      fileData,
      fullPath,
      jestConfig,
    );
    expect(transformedContent).toMatchSnapshot();
  });
});

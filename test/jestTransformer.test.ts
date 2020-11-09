import { Config } from '@jest/types';
import jestTransformer from '../src/jestTransformer';
import compiler from './__tools/compile';
import { join as pathJoin } from 'path';
import { rimraf } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/jestTransformer');
const jestConfig = { rootDir: cwd } as Config.ProjectConfig;

describe('graphql-let/jestTransformer', () => {
  beforeAll(async () => {
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
    const { code: transformedContent } = jestTransformer.process(
      fileData!,
      fullPath,
      jestConfig,
    ) as { code: string };
    expect(removeSourcemapReference(transformedContent)).toMatchSnapshot();
  });
});

function removeSourcemapReference(code: string) {
  // XXX: I couldn't find the better way to suppress sourcemaps
  return code.replace(/\n\/\/# sourceMappingURL=[\s\S]*/, '');
}

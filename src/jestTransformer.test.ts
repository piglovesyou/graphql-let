import { Config } from '@jest/types';
import { join as pathJoin } from 'path';
import compiler from '../test/__tools/compile';
import { AbsFn, prepareFixtures } from '../test/__tools/file';
import jestTransformer from './jestTransformer';

let cwd: string;
let abs: AbsFn;
let jestConfig: Config.ProjectConfig;

describe('graphql-let/jestTransformer', () => {
  beforeAll(async () => {
    [cwd, abs] = await prepareFixtures(__dirname, '__fixtures/jestTransformer');
    jestConfig = { rootDir: cwd } as Config.ProjectConfig;
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

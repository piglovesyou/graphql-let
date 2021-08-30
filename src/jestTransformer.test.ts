import { TransformOptions } from '@jest/transform';
import { Config } from '@jest/types';
import { join } from 'path';
import jestTransformer, { JestTransformerOptions } from './jestTransformer';
import compiler from './lib/__tools/compile';
import { prepareFixtures } from './lib/__tools/file';

let cwd: string;
let config: Config.ProjectConfig;

describe('graphql-let/jestTransformer', () => {
  beforeAll(async () => {
    [cwd] = await prepareFixtures(__dirname, '__fixtures/jestTransformer');
    config = { rootDir: cwd } as Config.ProjectConfig;
  });

  test('transforms .graphql', async () => {
    const fileName = 'pages/viewer.graphql';
    const stats = await compiler(cwd, [fileName], 'node');
    const { 0: fileData } = stats
      .toJson()
      .modules!.map((m) => m.source)
      .filter(Boolean);

    const fullPath = join(cwd, fileName);
    const { code: transformedContent } = jestTransformer.process(
      fileData!,
      fullPath,
      { config } as TransformOptions<JestTransformerOptions>,
    ) as { code: string };
    expect(removeSourcemapReference(transformedContent)).toMatchSnapshot();
  });
});

function removeSourcemapReference(code: string) {
  // XXX: I couldn't find the better way to suppress sourcemaps
  return code.replace(/\n\/\/# sourceMappingURL=[\s\S]*/, '');
}

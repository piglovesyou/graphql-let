import { TransformOptions } from '@jest/transform';
import { Config } from '@jest/types';
import { join } from 'path';
import jestTransformer, { JestTransformerOptions } from './jestTransformer';
import compiler from './lib/__tools/compile';
import { prepareFixtures } from './lib/__tools/file';

let cwd: string;
let config: Config.ProjectConfig;

describe('graphql-let/jestTransformer', () => {
  test('transforms .graphql', async () => {
    [cwd] = await prepareFixtures(__dirname, '__fixtures/jestTransformer');
    config = { rootDir: cwd } as Config.ProjectConfig;
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

  test('transforms .graphql when custom configFile and cache dirs set', async () => {
    [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/jestTransformerCustomPaths',
    );

    // Compile the file
    const fileName = 'pages/viewer.graphql';
    const stats = await compiler(cwd + '/subdir', [fileName], 'node', {
      configFile: './.graphql-let.yml',
    });
    const { 0: fileData } = stats
      .toJson()
      .modules!.map((m) => m.source)
      .filter(Boolean);

    // Run the config
    config = {
      rootDir: cwd,
      transform: [
        [
          'filePattern',
          'graphql-let/jestTransformer.js',
          {
            configFile: './subdir/.graphql-let.yml',
          },
        ],
      ],
    } as any;
    const fullPath = join(cwd + '/subdir', fileName);
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

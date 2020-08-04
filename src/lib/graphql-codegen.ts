import { Types } from '@graphql-codegen/plugin-helpers';
import { generate } from '@graphql-codegen/cli';
import makeDir from 'make-dir';
import path from 'path';
import { ExecContext } from './exec-context';
import { ConfigTypes } from './config';
import { withHash, writeFile } from './file';

export async function processGraphQLCodegen(
  options: Pick<Types.Config, 'schema' | 'documents'> & {
    cwd?: string;
    plugins: ConfigTypes['plugins'];
    config: ConfigTypes['config'];
    filename: string | string[];
    gqlHash: string;
  },
): Promise<string> {
  try {
    const results: Types.FileOutput[] = await generate(
      {
        cwd: options.cwd,
        schema: options.schema,
        documents: options.documents,

        generates: (Array.isArray(options.filename)
          ? options.filename
          : [options.filename]
        ).reduce<{
          [outputPath: string]: Types.ConfiguredOutput;
        }>((acc, filename) => {
          acc[filename] = {
            plugins: options.plugins,
            config: options.config,
          };
          return acc;
        }, {}),
      },
      false,
    );
    const resultsWithHash = results.map(({ filename, content }) => {
      // Embed hash for caching
      return {
        filename,
        content: withHash(options.gqlHash, content),
      };
    });
    await Promise.all(
      resultsWithHash.map(async ({ filename, content }) => {
        await makeDir(path.dirname(filename));
        await writeFile(filename, content);
      }),
    );
    return (resultsWithHash[0] && resultsWithHash[0].content) as string;
  } catch (e) {
    if (e.name === 'ListrError' && e.errors != null) {
      throw e.errors[0];
    } else {
      console.log('Error:', e);
    }
    throw e;
  }
}

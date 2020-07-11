import { Types } from '@graphql-codegen/plugin-helpers';
import { generate } from '@graphql-codegen/cli';
import makeDir from 'make-dir';
import path from 'path';
import createCodegenOpts from './create-codegen-opts';
import { ConfigTypes } from './types';
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
    const files = await generate(
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
    await Promise.all(
      files.map(
        async ({
          filename,
          content,
        }: {
          filename: string;
          content: string;
        }) => {
          await makeDir(path.dirname(filename));
          await writeFile(filename, withHash(options.gqlHash, content));
        },
      ),
    );
    return (files[0] && files[0].content) as string;
  } catch (e) {
    if (e.name === 'ListrError' && e.errors != null) {
      e.errors.forEach((detailError: any) => {
        console.log(detailError.details);
      });
    } else {
      console.log('Error:', e);
    }
    throw e;
  }
}
/**
 * Process graphql-codegen including calling "loadSchema", which is also a possibly expensive function
 */
export async function processGraphQLCodegenFromConfig(
  config: ConfigTypes,
  userDir: string,
  tsxFullPath: string,
  gqlRelPath: string,
  gqlContent: string,
  gqlHash: string,
) {
  const codegenOpts = await createCodegenOpts(config);

  return await processGraphQLCodegen({
    cwd: userDir,
    schema: config.schema,
    filename: tsxFullPath,
    documents: gqlContent,
    gqlHash,
    plugins: config.plugins,
    config: codegenOpts.config,
  });
}

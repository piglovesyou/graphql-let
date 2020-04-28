import { codegen } from '@graphql-codegen/core';
import gql from 'graphql-tag';
import makeDir from 'make-dir';
import path from 'path';
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { ConfigTypes } from './types';
import { withHash, writeFile } from './file';

export async function processGraphQLCodegen(
  codegenOpts: PartialCodegenOpts,
  tsxFullPath: string,
  gqlRelPath: string,
  gqlContent: string,
  gqlHash: string,
): Promise<string> {
  const documents = gqlContent
    ? [
        {
          location: gqlRelPath,
          document: gql(gqlContent),
        },
      ]
    : [];

  const tsxContent = await codegen({
    ...codegenOpts,
    filename: tsxFullPath,
    documents,
  });
  await makeDir(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, withHash(gqlHash, tsxContent));
  return tsxContent;
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
  const codegenOpts = await createCodegenOpts(config, userDir);
  return await processGraphQLCodegen(
    codegenOpts,
    tsxFullPath,
    gqlRelPath,
    gqlContent,
    gqlHash,
  );
}

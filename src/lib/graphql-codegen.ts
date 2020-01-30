import { codegen as graphqlCodegen } from '@graphql-codegen/core';
import { promises as fsPromises } from 'fs';
import gql from 'graphql-tag';
import makeDir from 'make-dir';
import path from 'path';
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { ConfigTypes } from './types';

const { writeFile } = fsPromises;

export async function processGraphQLCodegen(
  codegenOpts: PartialCodegenOpts,
  tsxFullPath: string,
  gqlRelPath: string,
  gqlContent: string,
): Promise<string> {
  const tsxContent = await graphqlCodegen({
    ...codegenOpts,
    filename: tsxFullPath,
    documents: [
      {
        location: gqlRelPath,
        document: gql(gqlContent),
      },
    ],
  });
  await makeDir(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
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
) {
  const codegenOpts = await createCodegenOpts(config, userDir);
  return await processGraphQLCodegen(
    codegenOpts,
    tsxFullPath,
    gqlRelPath,
    gqlContent,
  );
}

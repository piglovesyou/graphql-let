import { codegen as graphqlCodegen } from '@graphql-codegen/core';
import { promises as fsPromises } from 'fs';
import gql from 'graphql-tag';
import _mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import { PartialCodegenOpts } from './create-codegen-opts';
import memoize from './memoize';

const { writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

async function writeGraphQLCodegen(
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
        filePath: gqlRelPath,
        content: gql(gqlContent),
      },
    ],
  });
  await mkdirp(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
  return tsxContent;
}

export const processGraphQLCodegen = memoize(
  writeGraphQLCodegen,
  (_, tsxFullPath) => tsxFullPath,
);

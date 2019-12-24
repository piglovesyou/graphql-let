import { codegen as graphqlCodegenCodegen } from '@graphql-codegen/core';
import { promises as fsPromises } from 'fs';
import gql from 'graphql-tag';
import _mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import genDts from './gen-dts';
import { PartialCodegenOpts } from './create-codegen-opts';
import { ConfigTypes } from './types';

const { writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

function wrapAsModule(fileName: string, content: string) {
  return `declare module '*/${fileName}' {
  ${content.replace(/\n/g, '\n  ')}}`;
}

export async function codegen(
  gqlContent: string,
  gqlFullPath: string,
  tsxFullPath: string,
  dtsFullPath: string,
  options: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
): Promise<string> {
  const tsxContent = await graphqlCodegenCodegen({
    ...codegenOpts,
    filename: tsxFullPath,
    documents: [
      {
        filePath: gqlFullPath,
        content: gql(gqlContent),
      },
    ],
  });
  await Promise.all([
    mkdirp(path.dirname(tsxFullPath)),
    mkdirp(path.dirname(dtsFullPath)),
  ]);
  await writeFile(tsxFullPath, tsxContent);
  const dtsContent = await genDts(tsxFullPath);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(
    dtsFullPath,
    wrapAsModule(path.basename(gqlFullPath), dtsContent),
  );
  return tsxContent;
}

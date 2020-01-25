import { codegen as graphqlCodegen } from '@graphql-codegen/core';
import { existsSync, promises as fsPromises } from 'fs';
import gql from 'graphql-tag';
import _mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import { PartialCodegenOpts } from './create-codegen-opts';

const { readFile, writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

// For the loader can process a same file simultaneously
const processingTasks = new Map</*fileFullPath*/ string, Promise<string>>();

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
        filePath: gqlRelPath,
        content: gql(gqlContent),
      },
    ],
  });
  await mkdirp(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
  return tsxContent;
}

export async function readGraphQLCodegenCache(
  tsxFullPath: string,
): Promise<string | null> {
  if (existsSync(tsxFullPath)) {
    return await readFile(tsxFullPath, 'utf-8');
  } else if (processingTasks.has(tsxFullPath)) {
    return await processingTasks.get(tsxFullPath)!;
  }
  return null;
}

import { codegen as graphqlCodegen } from '@graphql-codegen/core';
import { promises as fsPromises } from 'fs';
import gql from 'graphql-tag';
import _mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import genDts from './gen-dts';
import { PartialCodegenOpts } from './create-codegen-opts';
import { printInfo } from './print';
import { ConfigTypes } from './types';
import { existsSync } from 'fs';

const { readFile, writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

// For the loader can process a same file simultaneously
const processingTasks = new Map<string /*fileFullPath*/, Promise<string>>();

function wrapAsModule(fileName: string, content: string) {
  return `declare module '*/${fileName}' {
  ${content.replace(/\n/g, '\n  ')}}`;
}

async function processGraphQLCodegen(
  codegenOpts: PartialCodegenOpts,
  tsxFullPath: string,
  gqlFullPath: string,
  gqlContent: string,
): Promise<string> {
  const tsxContent = await graphqlCodegen({
    ...codegenOpts,
    filename: tsxFullPath,
    documents: [
      {
        filePath: gqlFullPath,
        content: gql(gqlContent),
      },
    ],
  });
  await mkdirp(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
  return tsxContent;
}

async function processGenDts(
  dtsFullPath: string,
  tsxFullPath: string,
  gqlFullPath: string,
  dtsRelPath: string,
) {
  await mkdirp(path.dirname(dtsFullPath));
  const dtsContent = await genDts(tsxFullPath);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(
    dtsFullPath,
    wrapAsModule(path.basename(gqlFullPath), dtsContent),
  );
  printInfo(`${dtsRelPath} was generated.`);
  return dtsContent;
}

export async function codegen(
  gqlContent: string,
  gqlFullPath: string,
  tsxFullPath: string,
  dtsRelPath: string,
  dtsFullPath: string,
  options: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
): Promise<string> {
  let tsxContent: string;
  if (existsSync(tsxFullPath)) {
    tsxContent = await readFile(tsxFullPath, 'utf-8');
  } else if (processingTasks.has(tsxFullPath)) {
    tsxContent = await processingTasks.get(tsxFullPath)!;
  } else {
    const tsxPromise = processGraphQLCodegen(
      codegenOpts,
      tsxFullPath,
      gqlFullPath,
      gqlContent,
    );
    processingTasks.set(tsxFullPath, tsxPromise);
    tsxContent = await tsxPromise;
    processingTasks.delete(tsxFullPath);
  }

  if (existsSync(dtsFullPath) || processingTasks.has(dtsFullPath)) {
    // Already exists or is processing. Just skip.
  } else {
    const dtsPromise = processGenDts(
      dtsFullPath,
      tsxFullPath,
      gqlFullPath,
      dtsRelPath,
    );
    processingTasks.set(dtsFullPath, dtsPromise);
    await dtsPromise;
    processingTasks.delete(dtsFullPath);
  }

  return tsxContent;
}

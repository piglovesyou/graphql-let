import { promises as fsPromises } from 'fs';
import _mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import { createDts } from './create-dts';
import { PartialCodegenOpts } from './create-codegen-opts';
import { processGraphQLCodegen } from './graphql-codegen';
import { PREFIX as PRINT_PREFIX } from './print';
import { ConfigTypes } from './types';
import { existsSync } from 'fs';
import logUpdate from 'log-update';

const { readFile, writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

// For the loader can process a same file simultaneously
const processingTasks = new Map<string /*fileFullPath*/, Promise<string>>();

export function wrapAsModule(fileName: string, content: string) {
  return `declare module '*/${fileName}' {
  ${content.replace(/\n/g, '\n  ')}}`;
}

async function processGenDts(
  dtsFullPath: string,
  tsxFullPath: string,
  gqlRelPath: string,
) {
  await mkdirp(path.dirname(dtsFullPath));
  const [dtsContent] = await createDts([tsxFullPath]);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(
    dtsFullPath,
    wrapAsModule(path.basename(gqlRelPath), dtsContent),
  );
  return dtsContent;
}

export async function codegen(
  gqlContent: string,
  gqlRelPath: string,
  tsxFullPath: string,
  dtsRelPath: string,
  dtsFullPath: string,
  options: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
): Promise<string> {
  let tsxContent: string;
  if (existsSync(tsxFullPath)) {
    tsxContent = await readFile(tsxFullPath, 'utf-8');
  } else {
    tsxContent = await processGraphQLCodegen(
      codegenOpts,
      tsxFullPath,
      gqlRelPath,
      gqlContent,
    );
  }

  if (existsSync(dtsFullPath) || processingTasks.has(dtsFullPath)) {
    // Already exists or is processing. Just skip.
  } else {
    logUpdate(PRINT_PREFIX + 'Generating .d.ts...');

    const dtsPromise = processGenDts(dtsFullPath, tsxFullPath, gqlRelPath);
    processingTasks.set(dtsFullPath, dtsPromise);
    await dtsPromise;
    processingTasks.delete(dtsFullPath);

    logUpdate(PRINT_PREFIX + `${dtsRelPath} were generated.`);
  }

  return tsxContent;
}

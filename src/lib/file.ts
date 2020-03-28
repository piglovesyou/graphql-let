import { promises as fsPromises } from 'fs';
import glob from 'globby';
import _rimraf from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(_rimraf);

export const { readFile, writeFile } = fsPromises;

// Erasing old cache in __generated__ on HMR.
// Otherwise the multiple `declare module "*/x.graphql"` are exposed.
export async function removeByPatterns(cwd: string, ...patterns: string[]) {
  const oldFiles = await glob(patterns, {
    cwd,
    absolute: true,
  });
  await Promise.all(oldFiles.map((f) => rimraf(f)));
}

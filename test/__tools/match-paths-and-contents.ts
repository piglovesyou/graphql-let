import glob from 'globby';
import { readFile } from './file';
import { join } from 'path';

export async function matchPathsAndContents(globPatterns: string, cwd: string) {
  const files = (await glob(globPatterns, { cwd })).sort();
  expect(files).toMatchSnapshot(globPatterns);
  for (const file of files)
    expect(await readFile(join(cwd, file))).toMatchSnapshot(file);
}

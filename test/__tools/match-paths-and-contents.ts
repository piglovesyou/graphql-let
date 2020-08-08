import glob from 'globby';
import { readFile } from './file';
import { join } from 'path';

export async function matchPathsAndContents(
  globPatterns: string[],
  cwd: string,
) {
  const files = (await glob(globPatterns, { cwd })).sort();
  expect(files).toMatchSnapshot(globPatterns.join(' + '));
  await Promise.all(
    files.map((file) => {
      return readFile(join(cwd, file)).then((content) => {
        expect(content).toMatchSnapshot(file);
      });
    }),
  );
}

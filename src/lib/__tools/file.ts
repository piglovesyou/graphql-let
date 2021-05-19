import { constants, promises } from 'fs';
import globby from 'globby';
import makeDir from 'make-dir';
import pMap from 'p-map';
import { dirname, join } from 'path';
import _rimraf from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(_rimraf);

const crlf = /\r\n/g;
export function normalizeNewLine(str: string) {
  if (crlf.test(str)) return str.replace(crlf, '\n');
  return str;
}

export const { readFile: _readFile, writeFile, rename, copyFile } = promises;

export function readFile(file: string) {
  return _readFile(file, 'utf-8').then(normalizeNewLine);
}

export function cleanup(cwd: string, relPaths: string[]) {
  return Promise.all(relPaths.map((rel) => rimraf(join(cwd, rel))));
}

export type AbsFn = (rel: string) => string;

/**
 * Copy fixture dir for each test to avoid confliction
 */
export async function prepareFixtures(
  baseFullDir: string,
  fixtureSrcRelDir: string,
  fixtureDestRelDir = '.' + fixtureSrcRelDir,
): Promise<[cwd: string, abs: AbsFn]> {
  const files = await globby(['**'], {
    cwd: join(baseFullDir, fixtureSrcRelDir),
    dot: true,
    absolute: false,
  });
  await pMap(files, async (relPath) => {
    const srcPath = join(baseFullDir, fixtureSrcRelDir, relPath);
    const destFile = join(baseFullDir, fixtureDestRelDir, relPath);
    await makeDir(dirname(destFile));
    await copyFile(srcPath, destFile, constants.COPYFILE_EXCL);
  });
  const cwd = join(baseFullDir, fixtureDestRelDir);
  const abs = (relPath: string) => join(cwd, relPath);
  return [cwd, abs];
}

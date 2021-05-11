import { constants, promises } from 'fs';
import globby from 'globby';
import makeDir from 'make-dir';
import pMap from 'p-map';
import { dirname, join as pathJoin } from 'path';
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
  return Promise.all(relPaths.map((rel) => rimraf(pathJoin(cwd, rel))));
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
    cwd: pathJoin(baseFullDir, fixtureSrcRelDir),
    dot: true,
    absolute: false,
  });
  await pMap(files, async (relPath) => {
    const srcPath = pathJoin(baseFullDir, fixtureSrcRelDir, relPath);
    const destFile = pathJoin(baseFullDir, fixtureDestRelDir, relPath);
    await makeDir(dirname(destFile));
    await copyFile(srcPath, destFile, constants.COPYFILE_EXCL);
  });
  const cwd = pathJoin(baseFullDir, fixtureDestRelDir);
  const abs = (relPath: string) => pathJoin(cwd, relPath);
  return [cwd, abs];
}

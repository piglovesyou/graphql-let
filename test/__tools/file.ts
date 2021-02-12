import copyfiles from 'copyfiles';
import { promises } from 'fs';
import { join as pathJoin, sep } from 'path';
import _rimraf from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(_rimraf);

const crlf = /\r\n/g;
export function normalizeNewLine(str: string) {
  if (crlf.test(str)) return str.replace(crlf, '\n');
  return str;
}

export const { readFile: _readFile, writeFile, rename } = promises;

export function readFile(file: string) {
  return _readFile(file, 'utf-8').then(normalizeNewLine);
}

export function cleanup(cwd: string, relPaths: string[]) {
  return Promise.all(relPaths.map((rel) => rimraf(pathJoin(cwd, rel))));
}

export function copyDir(
  baseFullDir: string,
  srcRelDir: string,
  destRelDir: string,
): Promise<void> {
  // baseFullDir: /Users/a/b/c
  // srcRelDir: d/e
  // destRelDir: .d/e
  // It generates /Users/a/b/c/.d/e
  if (srcRelDir === destRelDir) throw new Error('Kidding me?');
  const up = pathJoin(baseFullDir).split(sep).length + 1;
  const [relRoot] = destRelDir.split('/');
  return new Promise<void>((resolve, rejects) => {
    copyfiles(
      [pathJoin(baseFullDir, srcRelDir, '**'), pathJoin(baseFullDir, relRoot)],
      { error: true, up, all: true },
      (err) => {
        if (err) return rejects(err);
        resolve();
      },
    );
  });
}

export type AbsFn = (rel: string) => string;

export async function prepareFixtures(
  baseFullDir: string,
  fixtureSrcRelDir: string,
): Promise<[cwd: string, abs: AbsFn]> {
  if (fixtureSrcRelDir.startsWith('..'))
    throw new Error(
      `It doesn't support backward relative paths like ${fixtureSrcRelDir}`,
    );
  const fixtureDestRelDir = '.' + fixtureSrcRelDir;
  const cwd = pathJoin(baseFullDir, fixtureDestRelDir);
  const abs = (relPath: string) => pathJoin(cwd, relPath);
  await copyDir(baseFullDir, fixtureSrcRelDir, fixtureDestRelDir);
  return [cwd, abs];
}

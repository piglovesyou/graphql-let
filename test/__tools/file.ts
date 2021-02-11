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

export function cleanup(cwd: string) {
  return Promise.all(
    [
      '**/.__fixtures',
      '**/__generated__',
      '**/node_modules',
      '**/dist',
      '**/*.graphql.d.ts',
      '**/*.graphqls.d.ts',
    ].map((rel) => rimraf(pathJoin(cwd, rel))),
  );
}

export function copyDirWithDot(
  baseFullDir: string,
  targetRelDir: string,
): Promise<string> {
  // baseFullDir: /Users/a/b/c
  // targetRelDir: d/e
  // resultDir: .d/e
  // return: /Users/a/b/c/.d/e
  const up = pathJoin(baseFullDir).split(sep).length + 1;
  const [relRoot] = targetRelDir.split('/');
  return new Promise<string>((resolve, rejects) => {
    copyfiles(
      [
        pathJoin(baseFullDir, targetRelDir, '**'),
        pathJoin(baseFullDir, '.' + relRoot),
      ],
      { error: true, up, all: true },
      (err) => {
        if (err) return rejects(err);
        resolve(pathJoin(baseFullDir, '.' + targetRelDir));
      },
    );
  });
}

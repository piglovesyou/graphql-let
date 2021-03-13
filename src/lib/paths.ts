import { extname, isAbsolute, join } from 'path';
import { ExecContext } from './exec-context';
import { FileImportCreatedPaths } from './types';

export const getCacheFullDir = (cwd: string, cacheDir: string) => {
  return isAbsolute(cacheDir) ? cacheDir : join(cwd, cacheDir);
};

export function toDtsPath(pathFragm: string) {
  return `${pathFragm}.d.ts`;
}

export function createPaths(
  { cwd, cacheFullDir }: ExecContext,
  gqlRelPath: string,
): FileImportCreatedPaths {
  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = join(cacheFullDir, tsxRelPath);
  const dtsRelPath = toDtsPath(gqlRelPath);
  const dtsFullPath = join(cwd, dtsRelPath);
  const gqlFullPath = join(cwd, gqlRelPath);

  return {
    gqlRelPath,
    tsxRelPath,
    tsxFullPath,
    dtsFullPath,
    dtsRelPath,
    gqlFullPath,
  };
}

export function isURL(p: string): boolean {
  try {
    new URL(p);
    return true;
  } catch (e) {
    return false;
  }
}

export function isTypeScriptPath(path: string) {
  const x = extname(path);
  return x === '.ts' || x === '.tsx';
}

import { isAbsolute, join, extname } from 'path';
import { ExecContext } from './exec-context';
import { GqlCreatedPaths } from './types';

export const getCacheFullDir = (cwd: string, cacheDir: string) => {
  return isAbsolute(cacheDir) ? cacheDir : join(cwd, cacheDir);
};

export function createPaths(
  { cwd, cacheFullDir }: ExecContext,
  gqlRelPath: string,
): GqlCreatedPaths {
  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = join(cacheFullDir, tsxRelPath);
  const dtsRelPath = `${gqlRelPath}.d.ts`;
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

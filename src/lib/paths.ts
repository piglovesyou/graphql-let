import path from 'path';

export type CreatedPaths = {
  gqlRelPath: string;
  tsxRelPath: string;
  tsxFullPath: string;
  dtsFullPath: string;
  dtsRelPath: string;
  gqlFullPath: string;
};

export const defaultCacheRelDir = '__generated__';
const libDir = path.resolve(__dirname, '../..');
const defaultCacheFullDir = path.join(libDir, defaultCacheRelDir);

export const getCacheFullDir = (cwd: string, cacheDir?: string) => {
  return !cacheDir
    ? defaultCacheFullDir
    : path.isAbsolute(cacheDir)
    ? cacheDir
    : path.join(cwd, cacheDir);
};

export function createPaths(
  cwd: string,
  gqlRelPath: string,
  customCacheDir?: string,
): CreatedPaths {
  const cacheFullDir = getCacheFullDir(cwd, customCacheDir);

  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = path.join(cacheFullDir, tsxRelPath);
  const dtsRelPath = `${gqlRelPath}.d.ts`;
  const dtsFullPath = path.join(cwd, dtsRelPath);
  const gqlFullPath = path.join(cwd, gqlRelPath);

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

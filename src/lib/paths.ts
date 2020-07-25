import path from 'path';

export type CreatedPaths = {
  gqlRelPath: string;
  tsxRelPath: string;
  tsxFullPath: string;
  dtsFullPath: string;
  dtsRelPath: string;
  gqlFullPath: string;
};

// export const libFullDir = path.resolve(__dirname, '../..');

export const getCacheFullDir = (cwd: string, cacheDir: string) => {
  return path.isAbsolute(cacheDir) ? cacheDir : path.join(cwd, cacheDir);
};

export function createPaths(
  cwd: string,
  gqlRelPath: string,
  cacheRelDir: string,
): CreatedPaths {
  const cacheFullDir = getCacheFullDir(cwd, cacheRelDir);

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

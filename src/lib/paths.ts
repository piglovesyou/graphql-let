import path from 'path';

export const DTS_OUTPUT_DIR = 'types';
export const TSX_OUTPUT_DIR = '__intermediate__';

export function createDtsRelDir(genRelPath: string) {
  return path.join(genRelPath, DTS_OUTPUT_DIR);
}

export function createPaths(
  cwd: string,
  genRelPath: string,
  gqlRelPath: string,
  hash: string,
) {
  const genFullDir = path.join(cwd, genRelPath);
  const dtsRelDir = createDtsRelDir(genRelPath);
  const tsxFullDir = path.join(genFullDir, TSX_OUTPUT_DIR);

  const gqlBasename = path.basename(gqlRelPath);
  const tsxRelPath = `${gqlRelPath}-${hash}.tsx`;
  const tsxFullPath = path.join(tsxFullDir, tsxRelPath);
  const dtsRelPath = path.join(dtsRelDir, `${gqlBasename}-${hash}.d.ts`);
  const dtsFullPath = path.join(cwd, dtsRelPath);

  // These are used to erase old cache from __generated__ on HMR.
  // Otherwise the multiple `declare module "*/x.graphql"` are exposed.
  const tsxRelRegex = `${gqlRelPath}-[a-z0-9]+.tsx`;
  const dtsRelRegex = path.join(dtsRelDir, `${gqlBasename}-[a-z0-9]+.d.ts`);

  return {
    gqlRelPath,
    tsxRelPath,
    tsxFullPath,
    dtsFullPath,
    dtsRelPath,
    tsxRelRegex,
    dtsRelRegex,
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

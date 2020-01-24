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
  return {
    gqlRelPath,
    tsxRelPath,
    tsxFullPath,
    dtsFullPath,
    dtsRelPath,
  };
}

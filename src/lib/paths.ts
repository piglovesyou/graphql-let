import path from 'path';

export function createPaths(
  cwd: string,
  genRelPath: string,
  gqlRelPath: string,
  hash: string,
) {
  const genFullDir = path.join(cwd, genRelPath);
  const dtsRelDir = path.join(genRelPath, 'types');
  const tsxFullDir = path.join(genFullDir, '__intermediate__');

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

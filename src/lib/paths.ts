import path from 'path';

export function createPaths(
  cwd: string,
  genRelPath: string,
  targetName: 'command' | 'web' | 'node' | string,
  gqlFullPath: string,
) {
  const genFullDir = path.join(cwd, genRelPath);
  const tsxFullDir = path.join(genFullDir, targetName);
  const dtsFullDir = path.join(genFullDir, 'types');

  const gqlRelPath = path.relative(cwd, gqlFullPath);
  const gqlBasename = path.basename(gqlRelPath);
  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = path.join(tsxFullDir, tsxRelPath);
  const dtsFullPath = path.join(dtsFullDir, `${gqlBasename}.d.ts`);
  const dtsRelPath = path.relative(cwd, dtsFullPath);
  return {
    genFullPath: tsxFullDir,
    gqlRelPath,
    gqlBasename,
    tsxRelPath,
    tsxFullPath,
    dtsDirPath: dtsFullDir,
    dtsFullPath,
    dtsRelPath,
  };
}

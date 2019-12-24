import path from 'path';

export function createPaths(
  cwd: string,
  genRelPath: string,
  gqlFullPath: string,
) {
  const genFullPath = path.join(cwd, genRelPath);
  const gqlRelPath = path.relative(cwd, gqlFullPath);
  const gqlBasename = path.basename(gqlRelPath);
  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = path.join(genFullPath, tsxRelPath);
  const dtsDirPath = path.join(genFullPath, 'types');
  const dtsFullPath = path.join(dtsDirPath, `${gqlBasename}.d.ts`);
  const dtsRelPath = path.relative(cwd, dtsFullPath);
  return {
    genFullPath,
    gqlRelPath,
    gqlBasename,
    tsxRelPath,
    tsxFullPath,
    dtsDirPath,
    dtsFullPath,
    dtsRelPath,
  };
}

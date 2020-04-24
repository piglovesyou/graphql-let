import path from 'path';

export type CreatedPaths = {
  gqlRelPath: string;
  tsxRelPath: string;
  tsxFullPath: string;
  dtsFullPath: string;
  dtsRelPath: string;
};

export const TSX_OUTPUT_DIR = '__generated__';
const libDir = path.resolve(__dirname, '../..');
const tsxFullDir = path.join(libDir, TSX_OUTPUT_DIR);

export function createPaths(cwd: string, gqlRelPath: string): CreatedPaths {
  const tsxRelPath = `${gqlRelPath}.tsx`;
  const tsxFullPath = path.join(tsxFullDir, tsxRelPath);
  const dtsRelPath = `${gqlRelPath}.d.ts`;
  const dtsFullPath = path.join(cwd, dtsRelPath);

  return {
    gqlRelPath,
    tsxRelPath,
    tsxFullPath,
    dtsFullPath,
    dtsRelPath,
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

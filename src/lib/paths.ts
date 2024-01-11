import { dirname, extname, isAbsolute, join } from 'path';
import { typesRootRelDir } from '../call-expressions/type-inject';
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

export const SCHEMA_TYPES_BASENAME = '__types__';

export function createSchemaPaths(execContext: ExecContext) {
  const { config, cacheFullDir } = execContext;
  const typeInjectFullDir = join(
    config.cwd,
    dirname(config.typeInjectEntrypoint),
  );

  const tsxRelPath = `${SCHEMA_TYPES_BASENAME}.tsx`;
  const tsxFullPath = join(cacheFullDir, tsxRelPath);
  const dtsRelPath = `${SCHEMA_TYPES_BASENAME}.d.ts`;
  const dtsFullPath = join(typeInjectFullDir, typesRootRelDir, dtsRelPath);

  return {
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
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

export function toDotRelPath(relPath: string) {
  return relPath.startsWith('.') ? relPath : './' + relPath;
}

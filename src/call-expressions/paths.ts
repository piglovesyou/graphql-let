import { basename, dirname, extname, join as pathJoin } from 'path';
import { ExecContext } from '../lib/exec-context';
import { typesRootRelDir } from '../lib/type-inject/literals';

export function createTiPaths(
  execContext: ExecContext,
  srcRelPath: string,
  callIdentity: string,
) {
  const abs = (relPath: string) => pathJoin(cwd, relPath);
  const { cwd, config, cacheFullDir } = execContext;
  const gqlDtsEntrypointFullDir = pathJoin(
    cwd,
    dirname(config.gqlDtsEntrypoint),
  );

  // srcRelPath: "pages/index.tsx"
  // "pages"
  const relDir = dirname(srcRelPath);
  // ".tsx"
  const ext = extname(srcRelPath);
  // "${cwd}/pages/index.tsx"
  const srcFullPath = abs(srcRelPath);
  // "index"
  const base = basename(srcRelPath, ext);

  // "index-2345.tsx"
  const tsxBasename = `${base}-${callIdentity}${ext}`;
  // "pages/index-2345.tsx"
  const tsxRelPath = pathJoin(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = pathJoin(cacheFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${callIdentity}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = pathJoin(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = pathJoin(
    gqlDtsEntrypointFullDir,
    typesRootRelDir,
    dtsRelPath,
  );
  return {
    srcRelPath,
    srcFullPath,
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
  };
}

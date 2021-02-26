import { existsSync } from 'fs';
import { basename, dirname, extname, join as pathJoin } from 'path';
import { ExecContext } from '../exec-context';
import { readHash, statSync } from '../file';
import { JSONObject } from '../to-sync';
import { typesRootRelDir } from './literals';

type TypeInjectDiff = {
  type: 'add' | 'remove';
  sourceRelPath: 'string';
  hash: 'string';
  gql?: 'string';
};

interface TypeInjectContext extends JSONObject {
  dtsEntrypointFullPath: string;
  storeFullPath: string;
  macroFullPath: string;
  lastModified: number;
  diffs: TypeInjectDiff[];
}

/**
 * Shape of node_modules/@types/graphql-let
 *    macro.d.ts --> export {gql,load} from './index.d.ts'
 *    index.d.ts -->
 *    store.json
 *    proj-root/
 *      input-X.d.ts --> Type decls for user's gql(`query X {}`) in index.ts(x)
 *      input-Y.d.ts --> Type decls for user's gql(`query Y {}`) in index.ts(x)
 */

export function createTypeInjectContext(
  execContext: ExecContext,
): TypeInjectContext {
  const { cwd, config } = execContext;
  const typeFullDir = pathJoin(cwd, dirname(config.gqlDtsEntrypoint));
  const storeFullPath = pathJoin(typeFullDir, 'store.json');
  return {
    dtsEntrypointFullPath: pathJoin(cwd, config.gqlDtsEntrypoint),
    storeFullPath,
    macroFullPath: pathJoin(typeFullDir, 'macro.d.ts'),
    lastModified: existsSync(storeFullPath)
      ? statSync(storeFullPath).mtimeMs
      : 0,
    diffs: [],
  };
}

/**
 * You have:
 *    - sourceRelPath
 *    - gqlName
 *    - hash of new gql
 *
 * If a file does not exit or hashes are different:
 *    - write a new one
 */

function createTiFullPath(
  tiContext: TypeInjectContext,
  sourceRelPath: string,
  gqlName: string,
) {
  const { dtsEntrypointFullPath } = tiContext;
  const ext = extname(sourceRelPath);
  const base = basename(sourceRelPath, ext);
  return pathJoin(
    dtsEntrypointFullPath,
    typesRootRelDir,
    dirname(sourceRelPath),
    `${base}--${gqlName}${ext}`,
  );
}

export function getHash(
  tiContext: TypeInjectContext,
  sourceRelPath: string,
  gqlName: string,
): string | null {
  const tiFullPath = createTiFullPath(tiContext, sourceRelPath, gqlName);
  return readHash(tiFullPath);
}

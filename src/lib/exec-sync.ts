import doSync, { Value } from 'do-sync';
import { join as pathJoin } from 'path';

export function execSync<T extends Value[], O extends Value>(
  moduleRelPath: string,
  fnName: string,
  args: T,
) {
  const libFullDir = pathJoin(__dirname, '../..');
  const moduleFullPath = pathJoin(libFullDir, moduleRelPath);
  return doSync<[string, string, T], O>((moduleFullPath, fnName, args) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require(moduleFullPath);
    if (!m[fnName])
      throw new Error(`${fnName} is not exported in ${moduleRelPath}`);
    return m[fnName](...args);
  })(moduleFullPath, fnName, args);
}

import { ConfigTypes } from './config';
import { getCacheFullDir } from './paths';

export type ExecContext = {
  cwd: string;
  config: ConfigTypes;
  configHash: string;
  cacheFullDir: string;
};

export default function createExecContext(
  cwd: string,
  config: ConfigTypes,
  configHash: string,
) {
  const cacheFullDir = getCacheFullDir(cwd, config.cacheDir);
  return {
    cwd,
    config,
    configHash,
    cacheFullDir,
  };
}

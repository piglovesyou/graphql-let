import { ConfigTypes } from "./config";
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { getCacheFullDir } from './paths';

export type ExecContext = {
  cwd: string;
  config: ConfigTypes;
  configHash: string;
  codegenOpts: PartialCodegenOpts;
  cacheFullDir: string;
};

export default function createExecContext(
  cwd: string,
  config: ConfigTypes,
  configHash: string,
) {
  const codegenOpts = createCodegenOpts(config);
  const cacheFullDir = getCacheFullDir(cwd, config.cacheDir);
  return {
    cwd,
    config,
    codegenOpts,
    configHash,
    cacheFullDir,
  };
}

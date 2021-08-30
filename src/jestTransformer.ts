import { SyncTransformer } from '@jest/transform';
import { ProjectConfig } from '@jest/types/build/Config';
import { readFileSync } from 'fs';
import { relative } from 'path';
import { loadConfigSync } from './lib/config';
import { createExecContextSync } from './lib/exec-context';
import { createHash } from './lib/hash';
import { createPaths } from './lib/paths';

export type JestTransformerOptions = {
  configFile?: string;
  subsequentTransformer?: string;
};

function getDefaultExportIfExists(moduleName: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(moduleName);

  return (mod?.default || mod) as typeof mod;
}

function getOption(jestConfig: ProjectConfig): JestTransformerOptions {
  if (!Array.isArray(jestConfig.transform)) return {};
  for (const [, entryPoint, opts] of jestConfig.transform) {
    if (entryPoint.endsWith('graphql-let/jestTransformer.js')) return opts;
  }
  return {};
}

const jestTransformer: SyncTransformer<JestTransformerOptions> = {
  getCacheKey(sourceText, sourcePath, options) {
    const configString = options?.configString || options;

    return createHash(sourceText + sourcePath + configString + 'graphql-let');
  },
  process(sourceText, sourcePath, ...rest) {
    // jest v26 vs v27 changes to support both formats: start
    const [__compatJestConfig] = rest;
    const jestConfig = __compatJestConfig?.config ?? __compatJestConfig;
    // jest v26 vs v27 changes to support both formats: end
    const { rootDir: cwd } = jestConfig;
    const { configFile, subsequentTransformer } = getOption(jestConfig);
    const [config, configHash] = loadConfigSync(cwd, configFile);
    const { execContext } = createExecContextSync(cwd, config, configHash);

    const { tsxFullPath } = createPaths(execContext, relative(cwd, sourcePath));
    const tsxContent = readFileSync(tsxFullPath, 'utf-8');

    // Let users customize a subsequent transformer
    if (subsequentTransformer) {
      const _subsequentTransformer = getDefaultExportIfExists(
        subsequentTransformer,
      );
      return _subsequentTransformer.process(tsxContent, tsxFullPath, ...rest);
    }

    // jest v26 vs v27 changes to support both formats: start
    // "babel-jest" by default
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createTransformer } = getDefaultExportIfExists('babel-jest');
    // jest v26 vs v27 changes to support both formats: end
    const babelTransformer = createTransformer({ cwd: cwd });
    return babelTransformer.process(tsxContent, tsxFullPath, ...rest);
  },
};

export default jestTransformer;

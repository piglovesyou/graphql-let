import { ProjectConfig } from '@jest/types/build/Config';
import { Transformer } from '@jest/transform';
import { relative as pathRelative } from 'path';
import { readFileSync } from 'fs';
import createExecContext from './lib/exec-context';
import { loadConfigSync } from './lib/config';
import { createPaths } from './lib/paths';
import { createHash } from './lib/hash';

type JestTransformerOptions = {
  subsequentTransformer?: string;
};

function getOption(jestConfig: ProjectConfig): JestTransformerOptions {
  if (!Array.isArray(jestConfig.transform)) return {};
  for (const [, entryPoint, opts] of jestConfig.transform) {
    if (entryPoint.endsWith('graphql-let/jestTransformer.js')) return opts;
  }
  return {};
}

const jestTransformer: Transformer = {
  getCacheKey(fileData, filename, configString) {
    return createHash(fileData + filename + configString + 'graphql-let');
  },
  process(input, filePath, jestConfig, transformOptions) {
    const { rootDir: cwd } = jestConfig;
    const [config, configHash] = loadConfigSync(cwd);
    const execContext = createExecContext(cwd, config, configHash);

    const { tsxFullPath } = createPaths(
      execContext,
      pathRelative(cwd, filePath),
    );
    const tsxContent = readFileSync(tsxFullPath, 'utf-8');

    // Let users customize a subsequent transformer
    const { subsequentTransformer } = getOption(jestConfig);
    if (subsequentTransformer) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(subsequentTransformer).process(
        tsxContent,
        tsxFullPath,
        jestConfig,
        transformOptions,
      );
    }

    // "babel-jest" by default
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createTransformer } = require('babel-jest');
    const babelTransformer = createTransformer({ cwd: cwd });
    return babelTransformer.process(
      tsxContent,
      tsxFullPath,
      jestConfig,
      transformOptions,
    );
  },
};

export default jestTransformer;

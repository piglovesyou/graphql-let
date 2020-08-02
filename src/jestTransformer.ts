import { ProjectConfig } from '@jest/types/build/Config';
import { Transformer } from '@jest/transform';
import { createTransformer, getCacheKey as getBabelCacheKey } from 'babel-jest';
import graphQLTransformer from 'jest-transform-graphql';
import { join as pathJoin, relative as pathRelative } from 'path';
import { readFileSync } from 'fs';
import createExecContext from './lib/exec-context';
import { loadConfigSync } from './lib/load-config';
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
  getCacheKey(fileData, filename, configString, cacheKeyOptions) {
    const babelCacheKey = getBabelCacheKey!(
      fileData,
      filename,
      configString,
      cacheKeyOptions,
    );

    return createHash(babelCacheKey + 'graphql-let');
  },
  process(input, filePath, jestConfig, transformOptions) {
    const { rootDir } = jestConfig;
    const [config, configHash] = loadConfigSync(rootDir);
    const execContext = createExecContext(rootDir, config, configHash);
    // TODO: This will break when an object is passed to config.schema
    const fileSchema = config.schema as string;
    const schemaFullPath = pathJoin(rootDir, fileSchema);

    if (schemaFullPath === filePath) {
      return graphQLTransformer.process(
        input,
        filePath,
        jestConfig,
        transformOptions,
      );
    }

    const { tsxFullPath } = createPaths(
      execContext,
      pathRelative(rootDir, filePath),
    );
    const tsxContent = readFileSync(tsxFullPath, 'utf-8');

    // Let users customize a subsequent transformer
    const { subsequentTransformer } = getOption(jestConfig);
    if (subsequentTransformer) {
      return require(subsequentTransformer).process(
        tsxContent,
        tsxFullPath,
        jestConfig,
        transformOptions,
      );
    }

    // "babel-jest" by default
    const babelTransformer = createTransformer({ cwd: rootDir });
    return babelTransformer.process(
      tsxContent,
      tsxFullPath,
      jestConfig,
      transformOptions,
    );
  },
};

export default jestTransformer;

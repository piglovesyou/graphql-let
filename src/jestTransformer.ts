import { createHash } from 'crypto';
import { Transformer } from '@jest/transform';
import { createTransformer, getCacheKey as getBabelCacheKey } from 'babel-jest';
import graphQLTransformer from 'jest-transform-graphql';
import { join as pathJoin, relative as pathRelative } from 'path';
import { readFileSync } from 'fs';
import { loadConfigSync } from './lib/load-config';
import { createPaths } from './lib/paths';

const jestTransformer: Transformer = {
  getCacheKey(fileData, filename, configString, cacheKeyOptions) {
    const babelCacheKey = getBabelCacheKey!(
      fileData,
      filename,
      configString,
      cacheKeyOptions as any,
    );

    return createHash('md5')
      .update(babelCacheKey)
      .update('graphql-let')
      .digest('hex');
  },
  process(input, filePath, jestConfig, transformOptions) {
    const { rootDir } = jestConfig;
    const [config] = loadConfigSync(rootDir);
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
      rootDir,
      pathRelative(rootDir, filePath),
      config.cacheDir,
    );

    const tsxContent = readFileSync(tsxFullPath, 'utf-8');

    const babelTransformer = createTransformer({ cwd: rootDir });

    return babelTransformer.process(
      tsxContent,
      tsxFullPath,
      jestConfig as any,
      transformOptions,
    );
  },
};

export default jestTransformer;

import { createHash } from 'crypto';
import { Transformer } from '@jest/transform';
import { createTransformer, getCacheKey as getBabelCacheKey } from 'babel-jest';
import graphQLTransformer from 'jest-transform-graphql';
import { relative as pathRelative } from 'path';
import { readFileSync } from 'fs';
import loadConfig from './lib/load-config';
import { createPaths } from './lib/paths';

const isSchemaFile = (filePath: string) => filePath.endsWith('.graphqls');

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
    if (isSchemaFile(filePath)) {
      return graphQLTransformer.process(
        input,
        filePath,
        jestConfig,
        transformOptions,
      );
    }

    const { rootDir } = jestConfig;
    const [config] = loadConfig(rootDir);

    const { tsxFullPath } = createPaths(
      rootDir,
      pathRelative(rootDir, filePath),
      config.cacheDir,
    );

    const tsxContent = readFileSync(tsxFullPath, 'utf-8');

    const babelTransformer = createTransformer({
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript',
        '@babel/preset-react',
      ],
    });

    return babelTransformer.process(
      tsxContent,
      tsxFullPath,
      jestConfig as any,
      transformOptions,
    );
  },
};

export default jestTransformer;

import { existsSync, promises as fsPromises } from 'fs';
import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { parse as parseYaml } from 'yaml';
import { processGenDts as _processGenDts } from './lib/dts';
import { removeOldCache } from './lib/file';
import { processGraphQLCodegenFromConfig as _processGraphQLCodegenFromConfig } from './lib/graphql-codegen';
import getHash from './lib/hash';
import memoize from './lib/memoize';
import { createPaths } from './lib/paths';
import {
  getHashOfSchema as _getHashOfSchema,
  getSchemaPaths as _getSchemaPaths,
  shouldGenResolverTypes,
} from './lib/resolver-types';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { PRINT_PREFIX } from './lib/print';

const { readFile } = fsPromises;
const processGraphQLCodegenFromConfig = memoize(
  _processGraphQLCodegenFromConfig,
  (_, __, tsxFullPath) => tsxFullPath,
);
const processGenDts = memoize(_processGenDts, dtsFullPath => dtsFullPath);
const getSchemaPaths = memoize(_getSchemaPaths, () => 'getSchemaPaths');
const getHashOfSchema = memoize(_getHashOfSchema, () => 'getHashOfSchema');

const graphlqCodegenLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;

  // Wrap them because loader.Loader doesn't expect Promise as the returned value
  (async () => {
    try {
      const { resourcePath: gqlFullPath, rootContext: userDir } = this;
      const configPath = pathJoin(userDir, DEFAULT_CONFIG_FILENAME);
      const config = parseYaml(
        await readFile(configPath, 'utf-8'),
      ) as ConfigTypes;

      let schemaHash = '';
      if (shouldGenResolverTypes(config)) {
        const schemaPaths = await getSchemaPaths(
          userDir,
          config.schema,
          config.respectGitIgnore,
        );
        schemaHash = await getHashOfSchema(schemaPaths);

        // If using resolver types, all documents should depend on all schema files.
        schemaPaths.forEach(p => this.addDependency(p));
      }

      const hash = getHash(gqlContent + schemaHash);
      const {
        tsxFullPath,
        dtsFullPath,
        dtsRelPath,
        gqlRelPath,
        tsxRelRegex,
        dtsRelRegex,
      } = createPaths(
        userDir,
        config.generateDir,
        pathRelative(userDir, gqlFullPath),
        hash,
      );

      let tsxContent: string;
      if (existsSync(tsxFullPath)) {
        tsxContent = await readFile(tsxFullPath, 'utf-8');
      } else {
        await removeOldCache(userDir, tsxRelRegex, dtsRelRegex);

        logUpdate(`${PRINT_PREFIX}Running graphql-codegen...`);
        tsxContent = await processGraphQLCodegenFromConfig(
          config,
          userDir,
          tsxFullPath,
          gqlRelPath,
          String(gqlContent),
        );
      }

      if (!existsSync(dtsFullPath)) {
        logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
        await processGenDts(dtsFullPath, tsxFullPath, gqlRelPath);
        logUpdate(PRINT_PREFIX + `${dtsRelPath} was generated.`);
        // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
        await new Promise(resolve => setTimeout(resolve, 0));
        logUpdate.done();
      }

      // Pretend .tsx for later loaders.
      // babel-loader at least doesn't respond the .graphql extension.
      this.resourcePath = `${gqlFullPath}.tsx`;

      callback(undefined, tsxContent);
    } catch (e) {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    }
  })();
};

export default graphlqCodegenLoader;

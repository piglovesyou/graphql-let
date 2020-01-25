import { existsSync, promises as fsPromises } from 'fs';
import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { parse as parseYaml } from 'yaml';
import { writeDts } from './lib/dts';
import { processGraphQLCodegenFromConfig } from './lib/graphql-codegen';
import getHash from './lib/hash';
import { createPaths } from './lib/paths';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { PRINT_PREFIX } from './lib/print';

const { readFile } = fsPromises;

const graphlqCodegenLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;

  // Wrap them because loader.Loader doesn't expect Promise as the returned value
  (async () => {
    try {
      const { resourcePath: gqlFullPath, rootContext: userDir, target } = this;
      const configPath = pathJoin(userDir, DEFAULT_CONFIG_FILENAME);
      const config = parseYaml(
        await readFile(configPath, 'utf-8'),
      ) as ConfigTypes;
      const hash = getHash(gqlContent);
      const { tsxFullPath, dtsFullPath, dtsRelPath, gqlRelPath } = createPaths(
        userDir,
        config.generateDir,
        pathRelative(userDir, gqlFullPath),
        hash,
      );

      let tsxContent: string;
      if (existsSync(tsxFullPath)) {
        tsxContent = await readFile(tsxFullPath, 'utf-8');
      } else {
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
        await writeDts(dtsFullPath, tsxFullPath, gqlRelPath);
        logUpdate(PRINT_PREFIX + `${dtsRelPath} was generated for ${target}.`);
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

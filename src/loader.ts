import { existsSync } from 'fs';
import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { parse as parseYaml } from 'yaml';
import { processGenDts } from './lib/dts';
import { removeOldCache } from './lib/file';
import { processGraphQLCodegenFromConfig } from './lib/graphql-codegen';
import getHash from './lib/hash';
import memoize from './lib/memoize';
import { createPaths } from './lib/paths';
import {
  getHashOfSchema,
  getSchemaPaths,
  shouldGenResolverTypes,
} from './lib/resolver-types';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { PRINT_PREFIX } from './lib/print';
import { readFile } from './lib/file';

const processGraphQLCodegenLoader = memoize(
  async (
    gqlFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
  ): Promise<string> => {
    const configPath = pathJoin(cwd, DEFAULT_CONFIG_FILENAME);
    const config = parseYaml(
      await readFile(configPath, 'utf-8'),
    ) as ConfigTypes;

    let schemaHash = '';
    if (shouldGenResolverTypes(config)) {
      const schemaPaths = await getSchemaPaths(
        cwd,
        config.schema,
        config.respectGitIgnore,
      );
      schemaHash = await getHashOfSchema(schemaPaths);

      // If using resolver types, all documents should depend on all schema files.
      schemaPaths.forEach(p => addDependency(p));
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
      cwd,
      config.generateDir,
      pathRelative(cwd, gqlFullPath),
      hash,
    );

    let tsxContent: string;
    if (existsSync(tsxFullPath)) {
      tsxContent = await readFile(tsxFullPath, 'utf-8');
    } else {
      await removeOldCache(cwd, tsxRelRegex, dtsRelRegex);

      logUpdate(`${PRINT_PREFIX}Running graphql-codegen...`);
      tsxContent = await processGraphQLCodegenFromConfig(
        config,
        cwd,
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

    return tsxContent;
  },
  (gqlFullPath: string) => gqlFullPath,
);

const graphlqCodegenLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;
  const { resourcePath: gqlFullPath, rootContext: cwd } = this;

  processGraphQLCodegenLoader(
    gqlFullPath,
    gqlContent,
    this.addDependency.bind(this),
    cwd,
  )
    .then((tsxContent: string) => {
      // Pretend .tsx for later loaders.
      // babel-loader at least doesn't respond the .graphql extension.
      this.resourcePath = `${gqlFullPath}.tsx`;

      callback(undefined, tsxContent);
    })
    .catch(e => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphlqCodegenLoader;

import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { processGenDts } from './lib/dts';
import { readHash, rimraf } from './lib/file';
import { processGraphQLCodegenFromConfig } from './lib/graphql-codegen';
import { createHash } from './lib/hash';
import loadConfig from './lib/load-config';
import memoize from './lib/memoize';
import { createPaths } from './lib/paths';
import { shouldGenResolverTypes } from './lib/resolver-types';
import { PRINT_PREFIX } from './lib/print';
import { readFile } from './lib/file';

const processGraphQLCodegenLoader = memoize(
  async (
    gqlFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
  ): Promise<string> => {
    const [config, configHash] = await loadConfig(cwd);

    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash = configHash;

    if (shouldGenResolverTypes(config)) {
      const schemaFullPath = pathJoin(cwd, config.schema);
      const content = await readFile(schemaFullPath);
      schemaHash = createHash(schemaHash + content);

      // If using resolver types, all documents should depend on all schema files.
      addDependency(schemaFullPath);
    }

    const { tsxFullPath, dtsFullPath, dtsRelPath, gqlRelPath } = createPaths(
      cwd,
      pathRelative(cwd, gqlFullPath),
    );
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== (await readHash(tsxFullPath)) ||
      gqlHash !== (await readHash(dtsFullPath));
    let tsxContent: string;
    if (shouldUpdate) {
      logUpdate(PRINT_PREFIX + 'Generating .d.ts...');

      await rimraf(tsxFullPath);
      await rimraf(dtsFullPath);

      tsxContent = await processGraphQLCodegenFromConfig(
        config,
        cwd,
        tsxFullPath,
        gqlRelPath,
        String(gqlContent),
        gqlHash,
      );

      await processGenDts(dtsFullPath, tsxFullPath, gqlRelPath, gqlHash);
      logUpdate(PRINT_PREFIX + `${dtsRelPath} was generated.`);
      // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
      await new Promise((resolve) => setTimeout(resolve, 0));
      logUpdate.done();
    } else {
      tsxContent = await readFile(tsxFullPath, 'utf-8');
    }

    return tsxContent;
  },
  (gqlFullPath: string) => gqlFullPath,
);

const graphlqCodegenLoader: loader.Loader = function (gqlContent) {
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
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphlqCodegenLoader;

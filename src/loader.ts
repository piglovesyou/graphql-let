import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import { readHash } from './lib/file';
import { processGraphQLCodegenFromConfig } from './lib/graphql-codegen';
import { createHash } from './lib/hash';
import loadConfig from './lib/config';
import memoize from './lib/memoize';
import { createPaths } from './lib/paths';
import { shouldGenResolverTypes } from './lib/resolver-types';
import { PRINT_PREFIX } from './lib/print';
import { readFile } from './lib/file';
import { CodegenContext } from './lib/types';

const processGraphQLCodegenLoader = memoize(
  async (
    gqlFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
  ): Promise<string> => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);

    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash;

    if (shouldGenResolverTypes(config)) {
      const fileSchema = config.schema as string;
      const schemaFullPath = pathJoin(cwd, fileSchema);
      const content = await readFile(schemaFullPath);
      schemaHash = createHash(configHash + content);

      // If using resolver types, all documents should depend on all schema files.
      addDependency(schemaFullPath);
    } else {
      schemaHash = configHash;
    }

    const createdPaths = createPaths(
      execContext,
      pathRelative(cwd, gqlFullPath),
    );
    const { tsxFullPath, dtsFullPath, dtsRelPath, gqlRelPath } = createdPaths;
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== (await readHash(tsxFullPath)) ||
      gqlHash !== (await readHash(dtsFullPath));
    let tsxContent: string;
    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.

      tsxContent = await processGraphQLCodegenFromConfig(
        execContext,
        tsxFullPath,
        gqlRelPath,
        String(gqlContent),
        gqlHash,
      );

      const codegenContext: CodegenContext[] = [
        {
          ...createdPaths,
          gqlHash,
          dtsContentDecorator: (_) => _,
          skip: false,
        },
      ];

      logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
      await processDtsForContext(execContext, codegenContext);
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

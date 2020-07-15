import logUpdate from 'log-update';
import { loader } from 'webpack';
import {
  processDtsForCodegenContext,
  prepareFullGenerate,
  processDocuments,
  processResolverTypesIfNeeded,
  CodegenContext,
  SkippedContext,
} from './lib/full-generate';
import loadConfig from './lib/load-config';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';

const processGraphQLCodegenSchemaLoader = memoize(
  async (cwd: string) => {
    const [config, configHash] = await loadConfig(cwd);

    const codegenContext: CodegenContext = [];
    const skippedContext: SkippedContext = [];

    const { codegenOpts, gqlRelPaths } = await prepareFullGenerate(cwd, config);

    const { schemaHash } = await processResolverTypesIfNeeded(
      cwd,
      config,
      configHash,
      codegenOpts,
      codegenContext,
      skippedContext,
    );

    // Only if schema was changed, documents are also handled for quick startup of webpack dev.
    if (codegenContext.length) {
      await processDocuments(
        gqlRelPaths,
        cwd,
        config,
        schemaHash,
        codegenOpts,
        codegenContext,
        skippedContext,
      );

      await processDtsForCodegenContext(codegenContext, config);
    }
  },
  () => 'schemaLoader',
);

const graphlqCodegenSchemaLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { rootContext: cwd } = this;

  processGraphQLCodegenSchemaLoader(cwd)
    .then(() => {
      callback(undefined, gqlContent);
    })
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphlqCodegenSchemaLoader;

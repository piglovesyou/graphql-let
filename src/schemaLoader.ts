import logUpdate from 'log-update';
import { loader } from 'webpack';
import createExecContext from './lib/exec-context';
import {
  processDtsForCodegenContext,
  prepareFullGenerate,
  processDocuments,
  processResolverTypesIfNeeded,
  CodegenContext,
  SkippedContext,
} from './lib/full-generate';
import loadConfig from './lib/config';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';

const processGraphQLCodegenSchemaLoader = memoize(
  async (cwd: string) => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);

    const codegenContext: CodegenContext[] = [];
    const skippedContext: SkippedContext[] = [];

    const gqlRelPaths = await prepareFullGenerate(execContext);

    const { schemaHash } = await processResolverTypesIfNeeded(
      execContext,
      codegenContext,
      skippedContext,
    );

    // Only if schema was changed, documents are also handled for quick startup of webpack dev.
    if (codegenContext.length) {
      await processDocuments(
        execContext,
        gqlRelPaths,
        schemaHash,
        codegenContext,
        skippedContext,
      );

      await processDtsForCodegenContext(execContext, codegenContext);
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

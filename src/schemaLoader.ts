import logUpdate from 'log-update';
import { loader } from 'webpack';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import {
  prepareFullGenerate,
  processDocumentsForContext,
  processResolverTypesIfNeeded,
} from './lib/full-generate';
import loadConfig from './lib/config';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';
import { CodegenContext, FileCodegenContext } from './lib/types';

const processGraphQLCodegenSchemaLoader = memoize(
  async (cwd: string) => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);

    const codegenContext: CodegenContext[] = [];

    const { graphqlRelPaths } = await prepareFullGenerate(execContext);

    const { schemaHash } = await processResolverTypesIfNeeded(
      execContext,
      codegenContext,
    );

    // Only if schema was changed, documents are also handled for quick startup of webpack dev.
    if (codegenContext.length) {
      await processDocumentsForContext(
        execContext,
        graphqlRelPaths,
        schemaHash,
        codegenContext,
      );

      await processDtsForContext(execContext, codegenContext);
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

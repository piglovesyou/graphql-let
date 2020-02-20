import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  processDtsForCodegenContext,
  prepareFullGenerate,
  processDocuments,
  processResolverTypesIfNeeded,
  CodegenContext,
} from './lib/full-generate';
import memoize from './lib/memoize';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { PRINT_PREFIX } from './lib/print';
import { readFile } from './lib/file';

const processGraphQLCodegenSchemaLoader = memoize(
  async (addDependency: (path: string) => void, cwd: string) => {
    const configPath = pathJoin(cwd, DEFAULT_CONFIG_FILENAME);
    const config = parseYaml(
      await readFile(configPath, 'utf-8'),
    ) as ConfigTypes;

    const codegenContext: CodegenContext = [];

    const { codegenOpts, gqlRelPaths } = await prepareFullGenerate(config, cwd);

    const { schemaHash, schemaPaths } = await processResolverTypesIfNeeded(
      config,
      cwd,
      codegenOpts,
      codegenContext,
    );

    // All documents and schema are dependencies, which change should invalidate caches.
    gqlRelPaths.forEach(p => addDependency(p));
    schemaPaths.forEach(p => addDependency(p));

    // Only if schema was changed, documents are also handled for quick startup of webpack dev.
    if (codegenContext.length) {
      await processDocuments(
        gqlRelPaths,
        cwd,
        config,
        schemaHash,
        codegenOpts,
        codegenContext,
      );

      await processDtsForCodegenContext(codegenContext);
    }
  },
  () => 'schemaLoader',
);

const graphlqCodegenSchemaLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;
  const { rootContext: cwd } = this;

  processGraphQLCodegenSchemaLoader(this.addDependency.bind(this), cwd)
    .then(() => {
      callback(undefined, gqlContent);
    })
    .catch(e => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphlqCodegenSchemaLoader;

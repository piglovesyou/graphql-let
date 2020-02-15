import { promises as fsPromises } from 'fs';
import logUpdate from 'log-update';
import { loader } from 'webpack';
import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import _fullGenerate, {
  finalizeCodegenContextIfNeeded,
  prepareFullGenerate,
  processDocuments,
  processResolverTypesIfNeeded,
  CodegenContext,
} from './lib/full-generate';
import memoize from './lib/memoize';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { PRINT_PREFIX } from './lib/print';

const { readFile } = fsPromises;
const fullGenerate = memoize(_fullGenerate, () => 'resolver-type');

const graphlqCodegenSchemaLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;

  // Wrap them because loader.Loader doesn't expect Promise as the returned value
  (async () => {
    try {
      const { rootContext: cwd } = this;
      const configPath = pathJoin(cwd, DEFAULT_CONFIG_FILENAME);
      const config = parseYaml(
        await readFile(configPath, 'utf-8'),
      ) as ConfigTypes;

      const { codegenOpts, gqlRelPaths } = await prepareFullGenerate(
        config,
        cwd,
      );

      const codegenContext: CodegenContext = [];

      const schemaHash = await processResolverTypesIfNeeded(
        config,
        cwd,
        codegenOpts,
        codegenContext,
      );

      // Only if schema was changed, documents are also handled for quick startup.
      if (codegenContext.length) {
        await processDocuments(
          gqlRelPaths,
          cwd,
          config,
          schemaHash,
          codegenOpts,
          codegenContext,
        );
        await finalizeCodegenContextIfNeeded(codegenContext, config);
      }

      // It just passes as it is
      callback(undefined, gqlContent);
    } catch (e) {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    }
  })();
};

export default graphlqCodegenSchemaLoader;

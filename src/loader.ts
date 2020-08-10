import logUpdate from 'log-update';
import { loader } from 'webpack';
import { relative as pathRelative, join, extname } from 'path';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { processDocumentsForContext } from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import loadConfig from './lib/config';
import memoize from './lib/memoize';
import { isTypeScriptPath } from './lib/paths';
import { createSchemaHash, shouldGenResolverTypes } from './lib/resolver-types';
import { PRINT_PREFIX, updateLog } from './lib/print';
import { readFile } from './lib/file';
import { CodegenContext } from './lib/types';

const processGraphQLLetLoader = memoize(
  async (
    resourceFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
  ): Promise<{ filename: string; content: string }> => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);

    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash = configHash;

    if (shouldGenResolverTypes(config)) {
      schemaHash = await createSchemaHash(execContext);
      const schemaFullPath = join(cwd, config.schemaEntrypoint);

      // If using resolver types, all documents should depend on all schema files.
      addDependency(schemaFullPath);
    }

    const codegenContext: CodegenContext[] = [];
    const ext = extname(resourceFullPath);

    if (isTypeScriptPath(resourceFullPath, ext)) {
      // TODO
      return {} as any;
    } else {
      // is GraphQL document
      const filename = `${resourceFullPath}.tsx`;
      const gqlRelPath = pathRelative(cwd, resourceFullPath);

      const [result] = await processDocumentsForContext(
        execContext,
        schemaHash,
        codegenContext,
        [gqlRelPath],
        [String(gqlContent)],
      );

      let content: string;
      // Cache was obsolete
      if (result) {
        const { content: _content } = result;
        content = _content;
        updateLog('Generating .d.ts...');
        await processDtsForContext(execContext, codegenContext);
        updateLog(`${gqlRelPath} was generated.`);

        // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
        await new Promise((resolve) => setTimeout(resolve, 0));
        logUpdate.done();
      } else {
        // When cache is fresh, just load it
        if (codegenContext.length !== 1) throw new Error('never');
        const [{ tsxFullPath }] = codegenContext;
        content = await readFile(tsxFullPath, 'utf-8');
      }
      return { filename, content };
    }
  },
  (gqlFullPath: string) => gqlFullPath,
);

const graphQLLetLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { resourcePath, rootContext: cwd } = this;

  processGraphQLLetLoader(
    resourcePath,
    gqlContent,
    this.addDependency.bind(this),
    cwd,
  )
    .then(({ filename, content }) => {
      // Pretend .tsx for later loaders.
      // babel-loader at least doesn't respond the .graphql extension.
      this.resourcePath = filename;

      callback(undefined, content);
    })
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphQLLetLoader;

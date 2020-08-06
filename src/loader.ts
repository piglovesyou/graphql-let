import logUpdate from 'log-update';
import { loader } from 'webpack';
import { relative as pathRelative } from 'path';
import { processDocumentsForContext } from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import loadConfig from './lib/config';
import memoize from './lib/memoize';
import {
  prepareGenResolverTypes,
  shouldGenResolverTypes,
} from './lib/resolver-types';
import { PRINT_PREFIX, updateLog } from './lib/print';
import { readFile } from './lib/file';
import { CodegenContext } from './lib/types';

const processGraphQLLetLoader = memoize(
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
    let schemaHash = configHash;

    if (shouldGenResolverTypes(config)) {
      const {
        schemaHash: _schemaHash,
        schemaFullPath,
      } = await prepareGenResolverTypes(execContext);
      schemaHash = _schemaHash;

      // If using resolver types, all documents should depend on all schema files.
      addDependency(schemaFullPath);
    }

    const gqlRelPath = pathRelative(cwd, gqlFullPath);
    const codegenContext: CodegenContext[] = [];

    const tsxContents = await processDocumentsForContext(
      execContext,
      schemaHash,
      codegenContext,
      [gqlRelPath],
      [String(gqlContent)],
    );

    // Cache was obsolete
    if (tsxContents[gqlRelPath]) {
      updateLog('Generating .d.ts...');
      await processDtsForContext(execContext, codegenContext);
      updateLog(`${gqlRelPath} was generated.`);

      // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
      await new Promise((resolve) => setTimeout(resolve, 0));
      logUpdate.done();
      return tsxContents[gqlRelPath];
    } else {
      // When cache is fresh, just load it
      if (codegenContext.length !== 1) throw new Error('never');
      const [{ tsxFullPath }] = codegenContext;
      return await readFile(tsxFullPath, 'utf-8');
    }
  },
  (gqlFullPath: string) => gqlFullPath,
);

const graphQLLetLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { resourcePath: gqlFullPath, rootContext: cwd } = this;

  processGraphQLLetLoader(
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

export default graphQLLetLoader;

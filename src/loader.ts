import { getOptions } from 'loader-utils';
import logUpdate from 'log-update';
import { join, relative as pathRelative } from 'path';
import { validate } from 'schema-utils';
import type { Schema as JsonSchema } from 'schema-utils/declarations/validate';
import { loader } from 'webpack';
import loadConfig from './lib/config';
import { processDocumentsForContext } from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import { readFile } from './lib/file';
import memoize from './lib/memoize';
import { PRINT_PREFIX, updateLog } from './lib/print';
import { createSchemaHash, shouldGenResolverTypes } from './lib/resolver-types';
import { CodegenContext } from './lib/types';

const optionsSchema: JsonSchema = {
  type: 'object',
  properties: {
    configFile: {
      type: 'string',
    },
  },
  required: [],
};
export interface GraphQLLetLoaderOptions {
  configFile?: string;
}

function parseOptions(ctx: loader.LoaderContext): GraphQLLetLoaderOptions {
  const options = getOptions(ctx);

  validate(optionsSchema, options);

  return (options as unknown) as GraphQLLetLoaderOptions;
}

const processGraphQLLetLoader = memoize(
  async (
    gqlFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
    options: GraphQLLetLoaderOptions,
  ): Promise<string> => {
    const [config, configHash] = await loadConfig(cwd, options.configFile);
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

    const gqlRelPath = pathRelative(cwd, gqlFullPath);
    const codegenContext: CodegenContext[] = [];

    const [result] = await processDocumentsForContext(
      execContext,
      schemaHash,
      codegenContext,
      [gqlRelPath],
      [String(gqlContent)],
    );

    // Cache was obsolete
    if (result) {
      const { content } = result;
      updateLog('Generating .d.ts...');
      await processDtsForContext(execContext, codegenContext);
      updateLog(`${gqlRelPath} was generated.`);

      // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
      await new Promise((resolve) => setTimeout(resolve, 0));
      logUpdate.done();
      return content;
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
  const options = parseOptions(this);

  processGraphQLLetLoader(
    gqlFullPath,
    gqlContent,
    this.addDependency.bind(this),
    cwd,
    options,
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

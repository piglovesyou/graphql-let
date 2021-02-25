import { getOptions } from 'loader-utils';
import logUpdate from 'log-update';
import { relative as pathRelative } from 'path';
import { validate } from 'schema-utils';
import type { Schema as JsonSchema } from 'schema-utils/declarations/validate';
import { loader } from 'webpack';
import { processCodegenForContext } from './gen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import { readFile } from './lib/file';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';
import { CodegenContext } from './lib/types';
import { appendFileContext } from './lib2/documents';
import { appendFileSchemaContext } from './lib2/resolver-types';

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
    const graphqlRelPath = pathRelative(cwd, gqlFullPath);
    const [config, configHash] = await loadConfig(cwd, options.configFile);
    const execContext = createExecContext(cwd, config, configHash);
    const codegenContext: CodegenContext[] = [];

    const { schemaHash } = await appendFileSchemaContext(
      execContext,
      codegenContext,
    );

    await appendFileContext(execContext, schemaHash, codegenContext, [
      graphqlRelPath,
    ]);

    const [{ skip, tsxFullPath }] = codegenContext;
    if (skip) return await readFile(tsxFullPath, 'utf-8');

    const [{ content }] = await processCodegenForContext(
      execContext,
      codegenContext,
    );

    await processDtsForContext(execContext, codegenContext);

    return content;
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

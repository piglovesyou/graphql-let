import { getOptions } from 'loader-utils';
import logUpdate from 'log-update';
import { validate } from 'schema-utils';
import type { Schema as JsonSchema } from 'schema-utils/declarations/validate';
import { loader } from 'webpack';
import { processCodegenForContext } from './lib/codegen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import { createExecContext } from './lib/exec-context';
import { readFile } from './lib/file';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';

const optionsSchema: JsonSchema = {
  type: 'object',
  properties: {
    configFile: {
      type: 'string',
    },
  },
  required: [],
};
export interface GraphQLLetSchemaLoaderOptions {
  configFile?: string;
}

function parseOptions(
  ctx: loader.LoaderContext,
): GraphQLLetSchemaLoaderOptions {
  const options = getOptions(ctx);

  validate(optionsSchema, options);

  return (options as unknown) as GraphQLLetSchemaLoaderOptions;
}

const processGraphQLCodegenSchemaLoader = memoize(
  async (cwd: string, options: GraphQLLetSchemaLoaderOptions) => {
    const [config, configHash] = await loadConfig(cwd, options.configFile);
    const { execContext, codegenContext } = await createExecContext(
      cwd,
      config,
      configHash,
    );

    const [{ skip, tsxFullPath }] = codegenContext;
    if (skip) return await readFile(tsxFullPath, 'utf-8');

    const [{ content }] = await processCodegenForContext(
      execContext,
      codegenContext,
    );

    await processDtsForContext(execContext, codegenContext);

    return content;
  },
  () => 'schemaLoader',
);

const graphlqCodegenSchemaLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { rootContext: cwd } = this;
  const options = parseOptions(this);

  processGraphQLCodegenSchemaLoader(cwd, options)
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

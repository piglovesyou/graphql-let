import generator from '@babel/generator';
import { getOptions } from 'loader-utils';
import logUpdate from 'log-update';
import { relative as pathRelative } from 'path';
import { validate } from 'schema-utils';
import type { Schema as JsonSchema } from 'schema-utils/declarations/validate';
import { loader } from 'webpack';
import { replaceCallExpressions } from './call-expressions/ast';
import {
  appendLiteralAndLoadContextForTsSources,
  writeTiIndexForContext,
} from './call-expressions/handle-codegen-context';
import { resolveGraphQLDocument } from './call-expressions/type-inject';
import { appendFileContext } from './file-imports/document-import';
import { appendFileSchemaContext } from './file-imports/schema-import';
import { processCodegenForContext } from './lib/codegen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import { readFile } from './lib/file';
import memoize from './lib/memoize';
import { PRINT_PREFIX, updateLog, updateLogDone } from './lib/print';
import {
  CodegenContext,
  isAllSkip,
  SchemaImportCodegenContext,
} from './lib/types';

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

const processLoaderForSources = memoize(
  async (
    sourceFullPath: string,
    sourceContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
    options: GraphQLLetLoaderOptions,
  ): Promise<string | Buffer> => {
    const [config, configHash] = await loadConfig(cwd, options.configFile);
    const { silent } = config;
    const execContext = createExecContext(cwd, config, configHash);
    const codegenContext: CodegenContext[] = [];
    const sourceRelPath = pathRelative(cwd, sourceFullPath);
    if (!silent) updateLog(`Processing ${sourceRelPath}...`);

    const { schemaHash } = await appendFileSchemaContext(
      execContext,
      codegenContext,
    );

    const paths = appendLiteralAndLoadContextForTsSources(
      execContext,
      schemaHash,
      codegenContext,
      [sourceRelPath],
    );
    if (!paths.length) throw new Error('Never');

    if (!codegenContext.length) return sourceContent;

    if (isAllSkip(codegenContext)) {
      if (!silent) updateLog(`Nothing to do. Cache was fresh.`);
      const [{ tsxFullPath }] = codegenContext;
      return await readFile(tsxFullPath, 'utf-8');
    }

    if (!silent) updateLog(`Processing codegen for ${sourceRelPath}...`);
    const [[fileNode, programPath, callExpressionPathPairs]] = paths;

    // Add dependencies so editing dependent GraphQL emits HMR.
    for (const context of codegenContext) {
      switch (context.type) {
        case 'document-import':
        case 'schema-import':
          throw new Error('Never');
        case 'gql-call':
        case 'load-call':
          for (const d of context.dependantFullPaths) addDependency(d);
          break;
      }
    }

    replaceCallExpressions(
      programPath,
      sourceFullPath,
      callExpressionPathPairs,
      codegenContext,
    );
    writeTiIndexForContext(execContext, codegenContext);
    await processCodegenForContext(execContext, codegenContext);
    if (!silent) updateLog(`Generating d.ts for ${sourceRelPath}...`);
    await processDtsForContext(execContext, codegenContext);

    const { code } = generator(fileNode);

    if (!silent) {
      updateLog(`Done processing ${sourceRelPath}.`);
      updateLogDone();
    }
    return code;
  },
  (gqlFullPath: string) => gqlFullPath,
);

const processLoaderForDocuments = memoize(
  async (
    gqlFullPath: string,
    gqlContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
    options: GraphQLLetLoaderOptions,
  ): Promise<string> => {
    const [config, configHash] = await loadConfig(cwd, options.configFile);
    const { silent } = config;
    const execContext = createExecContext(cwd, config, configHash);
    const codegenContext: SchemaImportCodegenContext[] = [];
    const graphqlRelPath = pathRelative(cwd, gqlFullPath);
    if (!silent) updateLog(`Processing ${graphqlRelPath}...`);

    // Add dependencies so editing dependent GraphQL emits HMR.
    const { dependantFullPaths } = resolveGraphQLDocument(
      gqlFullPath,
      String(gqlContent),
      cwd,
    );
    for (const d of dependantFullPaths) addDependency(d);

    const { schemaHash } = await appendFileSchemaContext(
      execContext,
      codegenContext,
    );
    const [schemaImportContext] = codegenContext;
    if (schemaImportContext) addDependency(schemaImportContext.gqlFullPath);

    // const documentImportCodegenContext: DocumentImportCodegenContext[] = [];
    await appendFileContext(execContext, schemaHash, codegenContext, [
      graphqlRelPath,
    ]);
    const [, fileContext] = codegenContext;
    if (!fileContext) throw new Error('Never');

    const { skip, tsxFullPath } = fileContext;
    if (skip) {
      if (!silent) updateLog(`Nothing to do. Cache was fresh.`);
      return await readFile(tsxFullPath, 'utf-8');
    }

    if (!silent) updateLog(`Processing codegen for ${graphqlRelPath}...`);
    const [{ content }] = await processCodegenForContext(
      execContext,
      codegenContext,
    );

    if (!silent) updateLog(`Generating d.ts for ${graphqlRelPath}...`);
    await processDtsForContext(execContext, [fileContext]);

    if (!silent) {
      updateLog(`Done processing ${graphqlRelPath}.`);
      updateLogDone();
    }
    return content;
  },
  (gqlFullPath: string) => gqlFullPath,
);

/**
 * Webpack loader to handle both *.graphql and *.ts(x).
 */
const graphQLLetLoader: loader.Loader = function (resourceContent) {
  const callback = this.async()!;
  const { resourcePath: resourceFullPath, rootContext: cwd } = this;
  const options = parseOptions(this);
  const addDependency = this.addDependency.bind(this);

  let promise: Promise<string | Buffer>;
  const isTypeScriptSource =
    resourceFullPath.endsWith('.ts') || resourceFullPath.endsWith('.tsx');
  if (isTypeScriptSource) {
    promise = processLoaderForSources(
      resourceFullPath,
      resourceContent,
      addDependency,
      cwd,
      options,
    );
  } else {
    promise = processLoaderForDocuments(
      resourceFullPath,
      resourceContent,
      addDependency,
      cwd,
      options,
    ).then((content) => {
      // Pretend .tsx for later loaders.
      // babel-loader at least doesn't respond the .graphql extension.
      this.resourcePath = `${resourceFullPath}.tsx`;

      return content;
    });
  }

  promise
    .then((tsxContent) => {
      callback(undefined, tsxContent);
    })
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphQLLetLoader;

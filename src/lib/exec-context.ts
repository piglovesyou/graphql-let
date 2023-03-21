import { Types } from '@graphql-codegen/plugin-helpers';
import { ApolloEngineLoader } from '@graphql-tools/apollo-engine-loader';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GitLoader } from '@graphql-tools/git-loader';
import { GithubLoader } from '@graphql-tools/github-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import {
  loadSchema as loadSchemaAsync,
  loadSchemaSync,
} from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import gensync from 'gensync';
import { printSchema } from 'graphql';
import { ConfigTypes } from './config';
import { createHash, createHashFromBuffers, readHash } from './hash';
import { createSchemaPaths, getCacheFullDir } from './paths';
import { CodegenContext, SchemaImportCodegenContext } from './types';

export type ExecContext = {
  cwd: string;
  config: ConfigTypes;
  configHash: string;
  cacheFullDir: string;
};

// From @graphql-codegen/plugin-helpers
function normalizeInstanceOrArray<T>(type: T | T[]): T[] {
  if (Array.isArray(type)) {
    return type;
  }
  if (!type) {
    return [];
  }

  return [type];
}

type SchemaConfig = { [index: string]: any };
function getSchemaPointers(
  schema: Types.InstanceOrArray<Types.Schema>,
): SchemaConfig {
  const schemaPointerMap: SchemaConfig = {};
  const normalizedSchema = normalizeInstanceOrArray(schema);

  normalizedSchema.forEach((denormalizedPtr) => {
    if (typeof denormalizedPtr === 'string') {
      schemaPointerMap[denormalizedPtr] = {};
    } else if (typeof denormalizedPtr === 'object') {
      Object.assign(schemaPointerMap, denormalizedPtr);
    }
  });

  return schemaPointerMap;
}

const loadSchema = gensync({
  sync: loadSchemaSync,
  async: loadSchemaAsync,
});

const createSchemaHashGenerator = gensync(function* (execContext: ExecContext) {
  const { config, configHash, cwd } = execContext;
  const schemaPointers = getSchemaPointers(config.schema!);

  // Uses the same loading mechanism as the underlying graphql-codegen
  // See https://github.com/dotansimha/graphql-code-generator/blob/master/packages/graphql-codegen-cli/src/load.ts
  const loaders = [
    new CodeFileLoader(),
    new GitLoader(),
    new GithubLoader(),
    new GraphQLFileLoader(),
    new JsonFileLoader(),
    new UrlLoader(),
    new ApolloEngineLoader(),
    // new PrismaLoader(), - not Node 12 compatible
  ];

  const parsedSchema = yield* loadSchema(schemaPointers, {
    cwd,
    loaders,
  });
  const schema = printSchema(parsedSchema);

  return createHashFromBuffers([configHash, schema]);
});

const appendSchemaImportContextGenerator = gensync(function* (
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const createdPaths = createSchemaPaths(execContext);
  const { configHash } = execContext;

  // We start our hash seed from configHash + schemaHash.
  // If either of them changes, the hash changes, which triggers
  // cache refresh in the subsequent generation process.
  const schemaHash = createHash(
    configHash + (yield* createSchemaHashGenerator(execContext)),
  );

  const shouldUpdate =
    schemaHash !== readHash(createdPaths.tsxFullPath) ||
    schemaHash !== readHash(createdPaths.dtsFullPath);

  const context: SchemaImportCodegenContext = {
    ...createdPaths,
    type: 'schema-import',
    gqlHash: schemaHash,
    skip: !shouldUpdate,
  };
  codegenContext.push(context);

  return schemaHash;
});

const createExecContextGenerator = gensync(function* (
  cwd: string,
  config: ConfigTypes,
  configHash: string,
) {
  const cacheFullDir = getCacheFullDir(cwd, config.cacheDir);
  const execContext = {
    cwd,
    config,
    configHash,
    cacheFullDir,
  };

  const codegenContext: CodegenContext[] = [];
  const schemaHash = yield* appendSchemaImportContextGenerator(
    execContext,
    codegenContext,
  );

  return { execContext, codegenContext, schemaHash };
});

export const createExecContext = createExecContextGenerator.async;
export const createExecContextSync = createExecContextGenerator.sync;

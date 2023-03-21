import { Types } from '@graphql-codegen/plugin-helpers';
import { ApolloEngineLoader } from '@graphql-tools/apollo-engine-loader';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GitLoader } from '@graphql-tools/git-loader';
import { GithubLoader } from '@graphql-tools/github-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import {
  loadSchemaSync,
} from '@graphql-tools/load';
import { printSchema } from 'graphql';
import { PrismaLoader } from '@graphql-tools/prisma-loader';
import { UrlLoader } from '@graphql-tools/url-loader';
import { readFileSync } from 'fs';
import gensync from 'gensync';
import slash from 'slash';
import { ConfigTypes } from './config';
import { globby } from './gensynced';
import { createHash, createHashFromBuffers, readHash } from './hash';
import { createSchemaPaths, getCacheFullDir, isURL } from './paths';
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

type SchemaConfig = { [index: string]: any }
function getSchemaPointers(
  schema: Types.InstanceOrArray<Types.Schema>
): SchemaConfig {
  const schemaPointerMap: SchemaConfig = {};
  const normalizedSchema = normalizeInstanceOrArray(schema);

  normalizedSchema.forEach(denormalizedPtr => {
    if (typeof denormalizedPtr === 'string') {
      schemaPointerMap[denormalizedPtr] = {};
    } else if (typeof denormalizedPtr === 'object') {
      Object.assign(schemaPointerMap, denormalizedPtr);
    }
  });

  return schemaPointerMap;
}

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
    new PrismaLoader(),
  ];

  const schema = printSchema(loadSchemaSync(schemaPointers, {
      cwd,
      loaders
  }));

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

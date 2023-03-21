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

function getSchemaPointers(
  schema: Types.InstanceOrArray<Types.Schema>,
  _acc: string[] = [],
): string[] {
  if (typeof schema === 'string') {
    _acc.push(schema);
  } else if (Array.isArray(schema)) {
    for (const s of schema) getSchemaPointers(s, _acc);
  } else if (typeof schema === 'object') {
    for (const s of Object.keys(schema)) getSchemaPointers(s, _acc);
  }
  return _acc;
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
      loaders: [ 
        new CodeFileLoader(), 
        new GraphQLFileLoader() 
      ]
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

import { Types } from '@graphql-codegen/plugin-helpers';
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

function prepareCreateSchemaHashArgs(execContext: ExecContext) {
  const { config, configHash, cwd } = execContext;
  const schemaPointers = getSchemaPointers(config.schema!);
  // TODO: How can we detect update of remote GraphQL Schema? ETag?
  // It caches the remote introspection forever in the current implementation.
  const filePointers = schemaPointers.filter((p) => !isURL(p));
  return { configHash, cwd, filePointers };
}

const createSchemaHashGenerator = gensync(function* (execContext: ExecContext) {
  const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
    execContext,
  );

  const files: string[] = yield* globby(filePointers, { cwd, absolute: true });
  const contents = files
    .map(slash)
    .sort()
    .map((file) => readFileSync(file, 'utf-8'));
  return createHashFromBuffers([configHash, ...contents]);
});
// export const createSchemaHash = createSchemaHashGenerator.async;
// export const createSchemaHashSync = createSchemaHashGenerator.sync;

// export function createSchemaHashSync(execContext: ExecContext) {
//   const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
//     execContext,
//   );
//
//   const files = globby.sync(filePointers, { cwd, absolute: true });
//   const contents = files
//     .map(slash)
//     .sort()
//     .map((file) => readFileSync(file));
//   return createHashFromBuffers([configHash, ...contents]);
// }

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
// export const appendSchemaImportContext =
//   appendSchemaImportContextGenerator.async;
// export const appendSchemaImportContextSync =
//   appendSchemaImportContextGenerator.sync;

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

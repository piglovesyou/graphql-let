import { Types } from '@graphql-codegen/plugin-helpers/types';
import { readFileSync } from 'fs';
import globby from 'globby';
import pMap from 'p-map';
import slash from 'slash';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { readFile, readHash } from './file';
import { processGraphQLCodegen } from './graphql-codegen';
import { createHashFromBuffers } from './hash';
import { createPaths, isURL } from './paths';
import { printError, updateLog } from './print';
import { CodegenContext, FileSchemaCodegenContext } from './types';

export function shouldGenResolverTypes(config: ConfigTypes): boolean {
  try {
    if (!config.schemaEntrypoint) return false;
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');
    const hasFilePointer = getSchemaPointers(config.schema!).some(
      (p) => !isURL(p),
    );
    if (!hasFilePointer) {
      printError(
        new Error(
          `To use Resolver Types, you should have at least one file in "schema".`,
        ),
      );
      return false;
    }
    return true;
  } catch (e) {
    // Just skip.
    return false;
  }
}

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
  const filePointers = schemaPointers.filter((p) => !isURL(p));
  return { configHash, cwd, filePointers };
}

export async function createSchemaHash(execContext: ExecContext) {
  const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
    execContext,
  );

  const files = await globby(filePointers, { cwd, absolute: true });
  const contents = await pMap(
    files.map(slash).sort(),
    (file) => readFile(file),
    { concurrency: 10 },
  );
  return createHashFromBuffers([configHash, ...contents]);
}

export function createSchemaHashSync(execContext: ExecContext) {
  const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
    execContext,
  );

  const files = globby.sync(filePointers, { cwd, absolute: true });
  const contents = files
    .map(slash)
    .sort()
    .map((file) => readFileSync(file));
  return createHashFromBuffers([configHash, ...contents]);
}

export async function processResolverTypesIfNeeded(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config, configHash } = execContext;
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    schemaHash = await createSchemaHash(execContext);
    const createdPaths = createPaths(execContext, config.schemaEntrypoint);

    const shouldUpdate =
      schemaHash !== readHash(createdPaths.tsxFullPath) ||
      schemaHash !== readHash(createdPaths.dtsFullPath);

    const context: FileSchemaCodegenContext = {
      ...createdPaths,
      type: 'schema',
      gqlHash: schemaHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);

    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.

      updateLog(
        `Local schema files are detected. Generating resolver types...`,
      );

      await processGraphQLCodegen(execContext, [context], {
        silent: true,
        ...config,
        cwd,
        generates: {
          [context.tsxFullPath]: {
            plugins: ['typescript', 'typescript-resolvers'],
          },
        },
      });
    }
  }
  return { schemaHash };
}
